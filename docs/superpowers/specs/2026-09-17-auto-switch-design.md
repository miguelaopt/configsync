# Auto-Switch / Background Sync — design

**Status:** approved 2026-09-17 · **Builds on:** ConfigSync foundation (`main` after PR #2)

## Goal

Pro users keep their game config files on each PC equal to the vault's **Default** preset for
every catalog game, without opening the app: change the Default from the phone, the PC picks
it up while the game is closed. A launch wrapper guarantees the files are right at the moment
a game starts.

## Finding that shapes the design

Games read their config files at start-up and rewrite them on exit. Detecting "the game just
started" and writing then is too late (the game already loaded the old values) and futile (the
game overwrites the files on exit). Therefore:

- process detection is used only to **avoid** writing while a game runs;
- the daemon applies **while the game is closed**, and a **launch wrapper** applies right
  before the game process starts.

## Product decisions

| Decision         | Choice                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Active preset    | The game's **Default** preset (`presets.isDefault`). No new concept, no per-device override.    |
| Daemon           | `csync watch` — polls every 30 s, applies when changed and the game is not running.             |
| Launch guarantee | `csync launch <game> -- <command…>` applies, then execs the command (Steam launch options).     |
| Autostart        | `csync watch --install` / `--uninstall`: systemd user unit (Linux), Startup shortcut (Windows). |
| Pro gating       | `GET /api/companion/sync` requires Pro (403 + sentence). `launch`/`apply` stay Free.            |
| Change detection | Server-side content fingerprint of the Default preset, not timestamps.                          |

## A. Catalog

`catalogGameSchema` gains `processNames: z.array(z.string().min(1)).default([])` — executable
names as they appear in a process list, without paths, all platforms mixed
(cs2: `["cs2", "cs2.exe"]`; rocket-league: `["RocketLeague.exe"]`). Included in `publicCatalog()`
so the CLI gets it from `/api/companion/catalog`.

## B. Server

### `GET /api/companion/sync`

Behind `companionRoute`. First line: `if ((await getPlan(userId)).plan !== "pro") throw new
AppError("Auto-switch is a Pro feature. Upgrade at <APP_URL>/pricing.", "forbidden")` →
`companionRoute` maps `forbidden` to **403** (today every `AppError` is 404; the wrapper gains
`code === "forbidden" ? 403 : 404`).

Response:

```json
{
  "games": [
    {
      "catalogId": "cs2",
      "gameSlug": "counter-strike-2",
      "presetSlug": "tournament",
      "presetName": "Tournament",
      "version": "9f2c1a…"
    }
  ]
}
```

One entry per non-archived game with a `catalogId` **and** a Default preset. `version` =
first 16 hex chars of `sha256(JSON.stringify(toPresetDoc(presetFull)))` — changes when any
value, setting, category or the Default choice changes. Data function
`listSyncTargets(userId)` in `lib/data/catalog.ts`.

`POST /api/companion/apply` is unchanged; the CLI reuses it.

## C. Companion

### `companion/lib/sync.mjs` (pure, tested)

```js
decide({ remote, applied, running });
```

- `remote`: `{ presetSlug, version } | null` (null = game has no Default / not in vault)
- `applied`: `{ presetSlug, version } | null` from `state.json`
- `running`: boolean
- returns `"apply" | "wait" | "skip"`: `skip` when `remote` is null or equals `applied`;
  `wait` when different and running; `apply` otherwise.

`companion/lib/procs.mjs`: `runningProcessNames()` → `Set<string>` — Linux/macOS: read
`/proc/*/comm` (fallback `ps -eo comm=`); Windows: `tasklist /fo csv /nh`, first column.
`isRunning(game, names)` = any `processNames` member in the set (case-insensitive).

### State

`~/.config/csync/state.json`: `{ applied: { [catalogId]: { presetSlug, version, at } } }`.
Written after every successful apply. `csync apply` and `csync launch` also record, so the
daemon doesn't re-apply what a manual command just wrote.

### `csync watch [--interval 30] [--once]`

Loop: `GET /sync` → for each catalog game: resolve file paths (existing `resolveFilePath`);
skip games with no files found here; `decide()`; on `apply` → `POST /apply` with current files
→ back up and write (same code path as `apply`, extracted to `applyPreset(c, game, presetSlug)`
in `companion/lib/apply.mjs`) → update state → log `applied <preset> to <game>`. On `wait` log
once per transition `waiting: <game> is running`. Network errors: log and retry next tick.
`--once` runs a single pass and exits (used by tests and by the wrapper). 403 from `/sync`:
print the server's sentence and exit 2.

### `csync launch <game> -- <command…>`

Applies the game's Default preset, then runs the command. The Default is fetched from
`GET /api/companion/default?game=<catalogId>` → `{ presetSlug, version }` (Free — manual apply
is a Free feature; only the multi-game `/sync` poll is Pro). Then
`spawn(command[0], command.slice(1), { stdio: "inherit" })` and exit with the child's code.
Any failure to apply is logged and the game still launches — never block a game because the
vault is down. `csync games` prints under each found game:
`Steam launch options: csync launch cs2 -- %command%`.

### `csync watch --install` / `--uninstall`

Linux: writes `~/.config/systemd/user/csync-watch.service` (`ExecStart=<node> <csync.mjs>
watch`, `Restart=on-failure`, `WantedBy=default.target`), runs `systemctl --user daemon-reload
&& systemctl --user enable --now csync-watch`. Windows: writes
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\csync-watch.cmd` with
`start "" /min node "<csync.mjs>" watch`. macOS: prints "not supported yet" and exits 2.
`--uninstall` reverses.

## D. Web

- Pricing: Auto-switch loses "(coming soon)"; copy: "Auto-switch: your PC keeps every game's
  files equal to its Default preset — `csync watch`".
- Settings → Companion card: install snippet gains `csync watch --install` (Pro) and a line
  "Steam launch options: `csync launch <game> -- %command%`".
- Preset header: when the preset is the Default of a catalog game, the Default badge gets a
  tooltip "Applied by csync watch on your PCs".

## Errors and safety

- Never write while the game runs; never write without a `.bak-<timestamp>`; never write a
  file the server didn't return (unchanged from `apply`).
- `launch` never blocks the game on errors.
- `/sync` leaks nothing beyond slugs, names and a hash.
- The daemon's log is one line per action; the token is never logged.

## Testing

- Unit (node --test): `decide()` matrix (null remote, same version, changed + running, changed +
  idle); `parseTasklist()` for the Windows CSV; `isRunning()` case-insensitivity.
- Unit (vitest): `presetFingerprint()` is stable across key order and changes with a value.
- Manual on this machine (Pro via the sandbox subscription): change CS2's Default in the web
  app → `csync watch --once` applies (backup present, `mat_vsync` changed) → run again → skip;
  `csync launch cs2 -- echo hi` applies then prints `hi`; with a Free account `/sync` → 403 and
  the CLI prints the sentence. Restore the real files from the `.bak-*` afterwards.
- e2e: unchanged (no browser flow added).

## Sequence

1. Catalog `processNames` + `/api/companion/default` + `/api/companion/sync` (+ 403 mapping,
   fingerprint, `listSyncTargets`).
2. Companion: `apply.mjs` extraction, `state`, `procs.mjs`, `sync.mjs` + tests.
3. `csync watch`, `csync launch`, `--install/--uninstall`, `games` hint.
4. Web copy (pricing, companion card, badge tooltip), docs (`docs/companion.md`,
   `docs/catalog.md`), memory of the design finding in the ADR-less docs.
