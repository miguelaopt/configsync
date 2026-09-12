# Game catalog, config-file import/export, game search and companion CLI

**Status:** approved design · 2026-09-12
**First games:** Counter-Strike 2 (Steam) and Rocket League (Epic / Steam)

## Goal

Let a user (1) add a game whose categories and settings match the real in-game menu, (2) find games by name and see what is installed on their PC, (3) import the settings a game already has on disk and write a preset back to disk. All without pretending the app talks to the game: the only write path is the companion CLI patching the game's own config files, with a backup, while the game is closed.

Out of scope: a GUI companion, phone/console detection, OCR, IGDB, zip downloads, Steam Web API. Windows paths are implemented but only Linux is tested in this iteration.

## Findings that shape the design

- CS2 stores everything as Valve KeyValues text under `<steam>/userdata/<uid>/730/local/cfg/`: `cs2_video.txt` (video), `cs2_user_convars_0_slot0.vcfg` (`config → convars`: sensitivity, crosshair, viewmodel…), `cs2_user_keys_0_slot0.vcfg` (`config → bindings`: **only keys that differ from default**). Booleans are `"1"/"0"` in video and `"true"/"false"` in convars.
- Rocket League stores only **Video** (`TASystemSettings.ini`, first `[SystemSettings]` section) and a few input values (`TAInput.ini`, `[TAGame.PlayerInput_TA]`) as text. Camera, controls and gameplay live in the binary profile save synced with Psyonix — they are in the catalog with exact names for manual entry, and are reported as "not stored in files" on import.
- The ini has many sections (`[SystemSettingsBucket1]`, `[SystemSettingsTexturesHigh]`…); menu presets like "Texture Detail" expand into low-level keys, so only settings with a 1:1 key get a `source`.

## A. Catalog

`catalog/<id>.json`, one file per game, validated by `catalogGameSchema` = `gameDocSchema` extended with:

```jsonc
{
  "id": "cs2",                       // stable, url-safe
  "steamAppId": 730,                 // optional
  "epicAppName": "Sugar",            // optional (Legendary/Epic app name)
  "files": [                         // config files the companion/web import can read
    {
      "id": "video",
      "format": "keyvalues",         // "keyvalues" | "ini"
      "bool": "01",                  // how booleans are written: "01" | "truefalse" | "TrueFalse"
      "section": [],                 // KV: path to the object holding keys, e.g. ["config","convars"]; INI: ["SystemSettings"]
      "paths": {                     // per platform/launcher, resolved by the companion
        "steam-linux": "{steam_userdata}/730/local/cfg/cs2_video.txt",
        "steam-windows": "{steam_userdata}/730/local/cfg/cs2_video.txt"
      }
    }
  ],
  "name": "Counter-Strike 2", "platforms": ["PC"], "tags": [...], "accentColor": "#…",
  "coverUrl": "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
  "presets": [ { "name": "Default", "isDefault": true, "categories": [ … ] } ]
}
```

Settings inside the preset are ordinary `settingDoc`s (exact in-game names, options with in-game labels, defaults) plus an optional `source`:

| `source` shape                                  | Meaning                                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ file, key }`                                 | scalar: boolean / number / string / enum. Enum `options[].value` **is the raw file value**, `label` is the menu text.                                                                                                           |
| `{ file, width, height }`                       | resolution split across two keys                                                                                                                                                                                                |
| `{ file, match: [{ value, keys: {k: v, …} }] }` | composite enum, e.g. Display Mode from `fullscreen` + `nowindowborder`. Read: first option whose keys all match. Write: all keys of the chosen option.                                                                          |
| `{ file, bind }`                                | CS2 keybind: setting value is the key bound to command `bind`. Read: key whose value is the command, else `defaultValue`. Write: `"<key>" "<command>"`, and `"<defaultKey>" "<unbound>"` when the key changed from the default. |

`source` is **not** part of the interchange/export format and is not stored in the DB. The catalog is the mapping; presets are matched to it by category name + setting name at export time. Renaming a setting in the vault silently drops it from file export — acceptable, documented.

Loader: `lib/catalog/index.ts` imports the JSON files statically, validates at module load, exposes `CATALOG: CatalogGame[]` and `getCatalogGame(id)`.

DB: `games.catalog_id text null` (+ index none; per-user lookups are by `user_id` already). Export format gains optional `catalogId` on game docs (compatible, additive).

UI: the Add-game dialog starts with a "From the catalog" list (cover, name, "N settings"); picking one calls `createGameFromCatalogAction(id)` → `importFile(userId, catalogAsExportFile)` and sets `catalog_id`. The game header shows a small "Catalog: CS2" badge with links to import/export config files.

## B. Config formats and mapping

`lib/game-configs/formats/keyvalues.ts`

- `parseKeyValues(text): KVNode` — tolerant of tabs, comments, `"key" "value"` and nested `{}`; preserves key order.
- `patchKeyValues(text, section: string[], updates: Record<string,string>): string` — rewrites values of existing keys in place (regex per key inside the section's brace block) and appends missing keys before the closing brace, keeping everything else byte-for-byte.

`lib/game-configs/formats/ini.ts`

- `parseIni(text): { [section]: { [key]: string } }` — first occurrence of a section wins (RL repeats keys in buckets); keys may repeat (`GamepadDeadzones=`) → first value kept.
- `patchIni(text, section, updates): string` — same in-place strategy; appends missing keys at the end of the section.

`lib/game-configs/index.ts`

- `readGameConfig(game: CatalogGame, files: Partial<Record<fileId,string>>): { preset: PresetDoc; missingFiles: string[]; unmappedSettings: string[]; unknownKeys: Record<fileId,string[]> }` — starts from the catalog preset (defaults), overwrites values found in files. Lenient boolean read (`1/0/true/false/True/False`), numbers via `Number()`, invalid → keep default and count in `unknownKeys`? No — invalid values are reported in `warnings: string[]`.
- `writeGameConfig(game, preset: PresetDoc, originalFiles): { files: Record<fileId,string>; skipped: string[] }` — for each catalog setting with a `source`, find the preset setting by category+name; serialise per the file's `bool` style; patch. Settings without a source or without an original file are `skipped`.

Web import: `/import` gets a second tab "From game files": choose a catalog game with files → one file input per file (any subset) → preview (`readGameConfig` in a server action; shows counts and warnings) → "Import as preset" into the user's matching game (created from the catalog if missing). Preset name: `Imported <YYYY-MM-DD>`.

Web export: preset actions menu → "Game config files…" dialog: for CS2 the files can be **generated from the catalog defaults** when the user has no originals to patch? No — without an original file, generation would emit a partial file the game may reject. The dialog explains that and offers download only when the companion is the writer… Decision: the web dialog lets the user **upload their current files** and downloads the patched ones (same server action as apply). Simple, honest, no zip: one download link per file.

Tests (`tests/game-configs.test.ts`): KV and INI parse/patch round-trips on fixtures derived from the real files (bindings stripped), CS2 and RL `readGameConfig`/`writeGameConfig` round-trip: read → write → read gives the same preset.

## C. Game search and installed games

- `lib/providers/steam-store.ts`: `searchSteamStore(q)` → `fetch("https://store.steampowered.com/api/storesearch/?term=…&cc=us&l=en")`, 5 s timeout, returns `{ appId, name, coverUrl }` (cover = `https://cdn.cloudflare.steamstatic.com/steam/apps/<appId>/header.jpg`). Server action `searchGamesAction(q)`; failures return `[]` (search is a convenience).
- Add-game dialog: the Name field shows suggestions after 300 ms / 2+ chars: first "Installed on <device>" matches from `device_games`, then Steam results. Picking fills name, platforms `["PC"]`, cover URL, and `catalog_id` when the Steam app id matches a catalog game.
- Table `device_games`: `id, user_id, device, source ('steam'|'epic'), app_id, name, install_dir, seen_at`, unique `(user_id, device, source, app_id)`. Written only by the companion; a `scan` replaces the device's rows.

## D. Companion CLI

Package `companion/` (workspace member, `"name": "gsv-companion"`, `bin: gsv`), plain ESM JavaScript, Node ≥ 20, no dependencies. Run as `pnpm gsv …` from the repo or `npm i -g ./companion`.

Config `~/.config/gsv/config.json` (`XDG_CONFIG_HOME` / `%APPDATA%\gsv` on Windows): `{ url, token, device }`.

Commands

- `gsv login <url>` — prompts for a token (created in Settings → Companion), verifies with `GET /api/companion/me`, saves. `device` defaults to the hostname.
- `gsv scan [--push]` — lists installed games; with `--push` sends them.
  - Steam: roots `~/.steam/steam`, `~/.local/share/Steam`, `~/.var/app/com.valvesoftware.Steam/.local/share/Steam`, `C:\Program Files (x86)\Steam`; libraries from `steamapps/libraryfolders.vdf`; each `appmanifest_*.acf` → `{appid, name, installdir}`; skip Proton, Steam Linux Runtime, Steamworks Common Redistributables.
  - Epic: Windows `%PROGRAMDATA%\Epic\EpicGamesLauncher\Data\Manifests\*.item` (`AppName`, `DisplayName`, `InstallLocation`); Linux Heroic `~/.config/heroic/legendaryConfig/legendary/installed.json`.
- `gsv import <catalogId> [--name "…"]` — `GET /api/companion/catalog` → resolve each file path for this machine → read what exists → `POST /api/companion/import { catalogId, device, files }` → server runs `readGameConfig`, creates the game from the catalog if the user has none with that `catalog_id`, creates the preset, returns `{ url, warnings, unmappedSettings }`. Prints them.
- `gsv apply <catalogId> <presetSlug> [--dry-run]` — reads current files → `POST /api/companion/apply { catalogId, presetSlug, files }` → server runs `writeGameConfig` → CLI writes each file after copying the original to `<file>.bak-<timestamp>`. Prints what changed. Warns before writing: _close the game first; Steam Cloud may restore old files (CS2 keeps `_lastclouded` copies)._

Path placeholders resolved by the CLI: `{steam_userdata}` (newest `userdata/<uid>` under the Steam root that has `730`… generic: the most recently modified uid dir), `{documents}` (native: `~/Documents` or `%USERPROFILE%\Documents`; under a Proton prefix: `steamapps/compatdata/<appid>/pfx/drive_c/users/steamuser/Documents`; under Heroic: `winePrefix` from `~/.config/heroic/GamesConfig/<appName>.json` + `/drive_c/users/<user>/Documents`, first existing user dir). Platform keys tried in order for the current OS: `epic-linux`, `steam-linux`, `epic-windows`, `steam-windows`.

Server

- Table `companion_tokens`: `id, user_id, name, token_hash (sha256), created_at, last_used_at`. Token = `gsv_` + 32 random bytes base64url, shown once. Settings page → "Companion" card: create (name), list, revoke; list of devices from `device_games` with last scan time; install/usage snippet.
- `lib/auth/companion.ts`: `requireCompanionUser(req)` — `Authorization: Bearer gsv_…` → hash → lookup → update `last_used_at` → userId, or 401.
- Routes under `app/api/companion/`: `me` (GET), `catalog` (GET, public shape of the catalog incl. `files`), `devices` (PUT: replace rows for `device`), `import` (POST), `apply` (POST). All JSON, Zod-validated, size-limited (each file ≤ 512 KB).

## Errors and safety

- Never overwrite an existing preset: import always creates a new one.
- `apply` never writes a file the server did not return, and never writes without a backup.
- Unknown file keys are preserved untouched; the CLI prints how many settings were skipped and why.
- Tokens are hashed; revoking deletes the row; `me` fails closed.

## Testing

- Unit: formats, mapping round-trips, catalog schema validation of every file in `catalog/`, token hashing/lookup.
- E2E addition: add CS2 from the catalog → editor shows "Video" with "Resolution"; import a fixture `cs2_video.txt` on the Import page → preset created with the fixture's resolution.
- Manual on this machine: `gsv scan` finds CS2 (Steam) and Rocket League (Heroic); `gsv import cs2` and `gsv import rocket-league` produce presets; `gsv apply --dry-run` shows a sane diff; a real `apply` on CS2 with the game closed, then reopen the game and check Video settings.

## Sequence

1. Catalog files + loader + schema tests + `catalog_id` migration + "From the catalog" in the dialog
2. Formats + `readGameConfig`/`writeGameConfig` + tests + web import tab + web config-files dialog
3. Steam store search + `device_games` + suggestions in the dialog
4. Companion package + tokens + routes + Settings card + docs (`docs/companion.md`, README section)
