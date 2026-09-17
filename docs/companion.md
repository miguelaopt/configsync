# Companion CLI (`gsv`)

`gsv` runs on the gaming PC. It lists installed games, reads a game's config files into the vault
as a new preset, and writes a preset back into those files. Plain Node ≥ 20, no dependencies,
source in [`companion/`](../companion/).

## Install

```sh
git clone <repo> && cd gamesettings-vault/companion && npm i -g .
gsv login https://your-vault.example      # paste a token from Settings → Companion
gsv scan --push
gsv import cs2
```

From a repo checkout, `pnpm gsv <command>` works without installing.

## Commands

| Command                                 | What it does                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `gsv login <url>`                       | Verify a token against `GET /api/companion/me` and save it. Token can be piped. |
| `gsv scan [--push]`                     | List Steam and Epic games installed here; `--push` replaces this device's list. |
| `gsv games`                             | List catalog games and which of their files were found on this machine.         |
| `gsv import <game> [--name "…"]`        | Read the found files into a **new** preset. Prints the preset URL and warnings. |
| `gsv apply <game> <preset> [--dry-run]` | Write a preset into the files. Backs up first; `--dry-run` only prints changes. |

`<game>` is a catalog id (`cs2`, `rocket-league`); `<preset>` is the slug in the preset's URL.

## Config

`~/.config/gsv/config.json` (`$XDG_CONFIG_HOME/gsv/config.json`; `%APPDATA%\gsv\config.json` on
Windows), mode 600: `{ "url", "token", "device" }`. `device` defaults to the hostname and names
this machine in Settings → Companion and in the imported preset name.

## How files are found

Each catalog file lists a path per launcher/OS. The CLI tries, in order, `steam-linux` then
`epic-linux` on Linux and `steam-windows` then `epic-windows` on Windows, and uses the first path
whose placeholders resolve and whose file exists.

| Placeholder        | Linux                                                                                                                                                                                                                                               | Windows                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `{steam_userdata}` | `~/.steam/steam`, `~/.local/share/Steam` or the Flatpak root → `userdata/<most recently used uid>`                                                                                                                                                  | `C:\Program Files (x86)\Steam\userdata\<uid>` |
| `{documents}`      | Steam/Proton: `steamapps/compatdata/<appid>/pfx/drive_c/users/steamuser/Documents` · Heroic: `winePrefix` from `~/.config/heroic/GamesConfig/<app>.json` (else the first prefix under `~/Games/Heroic/Prefixes`) → `drive_c/users/<user>/Documents` | `%USERPROFILE%\Documents`                     |

Extra Steam library folders come from `steamapps/libraryfolders.vdf`. Installed games come from
`appmanifest_*.acf` (Steam), `%PROGRAMDATA%\Epic\EpicGamesLauncher\Data\Manifests\*.item`
(Epic on Windows) and `~/.config/heroic/legendaryConfig/legendary/installed.json` (Heroic).

## Safety

- `apply` copies every file to `<file>.bak-<timestamp>` before writing it, and writes only files
  the server returned. Copy a backup back to undo.
- Only keys the catalog maps are touched; the rest of the file is preserved byte-for-byte.
- `import` always creates a new preset. Nothing in the vault is overwritten.
- **Close the game first.** Games rewrite their config on exit.
- **Steam Cloud** may restore an older file on launch (CS2 keeps `*_lastclouded` copies). If a
  change disappears, disable Cloud sync for that game and apply again.

## Tokens

Settings → Companion. A token is `gsv_` + 32 random bytes, shown once; the server stores only its
SHA-256. Revoking deletes it immediately — the CLI then fails with "Invalid or revoked companion
token" until you `gsv login` again. Use one token per machine so you can revoke them separately.

## Troubleshooting

| Symptom                                      | Fix                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `<file>: not found on this machine`          | Run the game once so it writes its config; check `gsv games` for the path it expects.            |
| Rocket League files not found under Heroic   | Set the game's Wine prefix in Heroic (it lands in `GamesConfig/<app>.json` as `winePrefix`).     |
| Wrong Steam account                          | The most recently used `userdata/<uid>` wins; launch Steam with the right account and try again. |
| `Not logged in`                              | `gsv login <url>` — the config file is per user and per machine.                                 |
| Applied change gone after launching the game | Steam Cloud restored the old file — see Safety.                                                  |
