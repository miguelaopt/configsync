# Windows desktop app — design

**Status:** approved 2026-09-23 · **Builds on:** csync 0.3.0 (PR #51), which is live

## Goal

A Windows player installs ConfigSync by double-clicking an installer, and from then on the
companion lives in the notification area. Opening it shows the games this PC has, which preset
each one runs, and a button to apply or to import what the game currently has. Auto-switch is a
toggle. Nobody opens PowerShell.

The CLI does not go away — it stays the whole product on Linux and remains available on Windows.
The app is a second face on the same logic, not a replacement for it.

## Product decisions

| Decision        | Choice                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell           | Tauri. Native window and tray, system WebView2, ~6 MB.                                                                                        |
| Logic           | **Unchanged.** `csync.exe` ships inside the installer as a Tauri sidecar and does every filesystem and network operation, exactly as today.   |
| Rust rewrite    | Explicitly deferred. Revisit only if real installs show the ~96 MB download is what loses people. The window does not change when it happens. |
| GUI ↔ CLI seam  | A JSON contract, not prose parsing: `csync status --json`, and `--json` on `apply` and `import`.                                              |
| Auto-switch     | The app owns `csync watch` as a child process and reflects it in the tray. The Startup `.cmd` is migrated away on first run.                  |
| Login           | Token pasted into the app, piped to `csync login` over **stdin** — never argv, which is readable from other processes.                        |
| Code signing    | Out of scope this round. SmartScreen keeps warning; the guide keeps saying so.                                                                |
| Installer build | GitHub Actions Windows runner, not the Docker image. The artifact is pulled to the server at deploy and served by Caddy.                      |
| v1 scope        | Connect · see games · apply · import · auto-switch toggle.                                                                                    |
| Out of scope    | `discover` (contributor tool, stays CLI), `launch` (a Steam launch option, not a button), macOS, Linux GUI, per-setting editing in the app.   |

## A. The JSON contract

This is phase 1 and the only part verifiable without Windows. It exists because the CLI prints
sentences for people — `Wrote C:\…\cs2_video.txt (backup: …bak-2026-09-23…)` — and a GUI that
reads English breaks the first time a word changes.

### `csync status [--json]`

One call returns everything the main window shows, so opening the app is a single round trip.
Without `--json` it prints the same information as a short human summary, which is useful on its
own.

```jsonc
{
  "loggedIn": true,
  "url": "https://configsync.app",
  "device": "win-01",
  "user": { "email": "you@example.com" },
  "plan": "pro", // "free" | "pro"; auto-switch is Pro
  "games": [
    {
      "id": "cs2",
      "name": "Counter-Strike 2",
      "installed": true, // its config files resolve on this machine
      "files": 4, // how many of them were found
      "target": { "presetSlug": "competitive", "presetName": "Competitive", "version": "a1b2c3" },
      "applied": {
        "presetSlug": "competitive",
        "at": "2026-09-23T14:02:00.000Z",
        "status": "applied",
      },
    },
  ],
}
```

`loggedIn: false` is a complete, successful answer with no `games` — the app shows its connect
screen rather than an error.

**Where each field comes from** (checked against the live routes, not assumed):

| Field             | Source                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `plan`    | `GET /api/companion/me` — it already returns `plan`, so no server change is needed.                                                                               |
| `games[].id/name` | `GET /api/companion/catalog`.                                                                                                                                     |
| `installed/files` | `readFiles()` locally; no network.                                                                                                                                |
| `target`          | `GET /api/companion/default?game=&device=` per catalog game. **Not** `/sync`, which is Pro-only — `/default` is Free, so the app works identically on both plans. |
| `applied`         | the local `state.json`, through `loadState()`.                                                                                                                    |

Two consequences worth naming:

- `/default` throws `not_found` when the user has no Default preset for that game. `status` must
  catch that per game and return `"target": null`, not fail the whole call. A new user has no
  presets at all, and the window still has to render.
- `/default` calls `touchDevice`, so opening the app marks this PC as seen. That is wanted — the
  web app's "last seen" stops going stale for someone who uses the window instead of `watch`.

### `csync apply <game> <preset> --json`

```jsonc
{
  "wrote": ["video", "convars"], // logical file ids, never absolute paths
  "changed": { "video": { "setting.defaultres": "2560" } },
  "skipped": ["Audio › EQ Profile is not stored in files"],
  "backups": 2,
}
```

Absolute paths stay out: the window has no use for them and they are the most personal thing the
companion touches.

### `csync import <game> --json`

```jsonc
{
  "url": "/games/counter-strike-2/imported-2026-09-23",
  "missingFiles": [],
  "unmappedSettings": 13,
  "warnings": [],
}
```

### Errors

With `--json`, a failure prints `{ "error": "Counter-Strike 2 is running. Close it and apply
again." }` to **stdout** and exits non-zero. The message is the same one a human would get; the
app shows it verbatim rather than inventing its own wording. Nothing is written to stderr that the
app is expected to read.

## B. The window

One screen, matching the app's existing panel grammar and palette.

```
┌─ ConfigSync ────────────────────────────┐
│  win-01                         Pro ●   │
├─────────────────────────────────────────┤
│  Counter-Strike 2          4 files      │
│    Competitive              [Apply]     │
│    applied today at 14:02               │
│                                         │
│  Rocket League             2 files      │
│    Default                  [Apply]     │
│    never applied                        │
│                                         │
│  [Import this PC's settings]            │
├─────────────────────────────────────────┤
│  Auto-switch            [ ●───]  on     │
└─────────────────────────────────────────┘
```

- A game whose files are not on this machine is listed greyed with "not installed here", not
  hidden — otherwise a missing game looks like a bug.
- `Apply` disables itself while running and reports the result inline, including the refusal when
  the game is open. That refusal is a feature and should read like one.
- Not signed in: a single screen with "Open ConfigSync" (launches the browser at
  `/settings#companion`) and a field to paste the token.

## C. Tray and auto-switch

The tray menu is four items: **Open**, **Apply now**, **Auto-switch ✓**, **Quit**.

The app starts with Windows through Tauri's autostart plugin. When auto-switch is on it spawns
`csync watch` as a managed child and surfaces its state; when off, it does not. One owner, one
process tree, and the icon always tells the truth.

**Migration.** `csync watch --install` writes `%APPDATA%\…\Startup\csync-watch.cmd` today. On
first run the app removes that file if present and takes over, so an existing user does not end
up with two things applying presets. `--install` stays in the CLI for people who do not want the
app.

## D. Packaging and distribution

The riskiest part, and the one most likely to need a second pass.

`pnpm build:companion` runs inside the Docker image build on Alpine and produces
`public/csync-*`. An `.msi` cannot be produced that way — Tauri wants a Windows toolchain.

```
GitHub Actions (windows-latest)
  └─ build csync.exe (existing SEA) ─┐
  └─ cargo tauri build ──────────────┴─→ ConfigSync.msi  (release artifact)

deploy on the server
  └─ fetch the artifact for this version → /srv/downloads/ConfigSync.msi → served by Caddy
```

The download page links to `configsync.app/ConfigSync.msi`. The repository is never visible to a
user, which `AGENTS.md` rule 7 requires.

The Linux path is untouched: `install.sh` and `csync-linux-x64` keep coming out of the image
build.

## Errors and safety

- **The write path does not change.** The app calls the same binary, which still refuses to write
  while the game runs, still backs up first, and still fails closed when it cannot read the
  process list. Nothing about that logic is reimplemented in Rust or in JavaScript.
- The sidecar is invoked with an argument array, never a shell string, so a preset or game name
  can never be interpreted as a command.
- The token is piped over stdin. It is never an argument and never written to a log.
- The window renders only values the CLI returned. It has no filesystem access of its own.
- If `csync.exe` is missing or fails to start, the app says so plainly and points at the CLI,
  rather than showing an empty window.

## Tests

| Layer         | How                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| JSON contract | Unit tests in `companion/test/` for shape, for the logged-out case, and for the error envelope. Runs on Linux, in CI, today.        |
| Apply safety  | Already covered by `companion/test/apply.test.mjs`; the app inherits it by construction.                                            |
| The app       | Manual, on the Windows boot, following a `TEST-WINDOWS.md`-style checklist written as part of phase 3.                              |
| Packaging     | The CI job either produces an `.msi` or it does not; a smoke step asserts the artifact exists and is over a plausible minimum size. |

**Only phase 1 can be verified from the development machine, which is Linux.** Phases 2–4 are
written here and tested by the owner on Windows. That is a constraint of the project, not an
oversight, and the phases are ordered so the untestable work comes last.

## Phases

1. **JSON contract** — `status`, `--json` on `apply` and `import`, error envelope, tests. Ships on
   its own as a CLI improvement, useful even if the app never arrives. **This phase gets its own
   implementation plan**; phases 2–4 are planned once it is in and the contract has survived
   contact with a real window.
2. **Window** — Tauri project, sidecar wiring, connect screen, game list, apply, import.
3. **Tray** — menu, autostart, watch ownership, migration off the Startup `.cmd`.
4. **Distribution** — CI job on a Windows runner, deploy fetch, download page.
