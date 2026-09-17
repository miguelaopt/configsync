# Companion CLI (`csync`)

`csync` runs on the gaming PC. It lists installed games, reads a game's config files into the vault
as a new preset, and writes a preset back into those files. Plain Node ≥ 20, no dependencies,
source in [`companion/`](../companion/).

## Install

```sh
git clone <repo> && cd configsync/companion && npm i -g .
csync login https://your-vault.example      # paste a token from Settings → Companion
csync scan --push
csync import cs2
```

From a repo checkout, `pnpm csync <command>` works without installing.

## Commands

| Command                                   | What it does                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `csync login <url>`                       | Verify a token against `GET /api/companion/me` and save it. Token can be piped.                                  |
| `csync scan [--push]`                     | List Steam and Epic games installed here; `--push` replaces this device's list.                                  |
| `csync games`                             | List catalog games and which of their files were found on this machine.                                          |
| `csync import <game> [--name "…"]`        | Read the found files into a **new** preset. Prints the preset URL and warnings.                                  |
| `csync apply <game> <preset> [--dry-run]` | Write a preset into the files. Backs up first; `--dry-run` only prints changes.                                  |
| `csync watch [--interval 30] [--once]`    | **Pro.** Keep every game's files equal to its Default preset (see below). `--install` / `--uninstall` autostart. |
| `csync launch <game> -- <command…>`       | Apply the game's Default preset, then run the command. For Steam launch options and Heroic wrappers.             |

`<game>` is a catalog id (`cs2`, `rocket-league`); `<preset>` is the slug in the preset's URL.

## Background sync (`csync watch`, Pro)

Every 30 s the daemon asks the vault for the **Default** preset of each catalog game you own,
with a fingerprint of its content. When the fingerprint differs from what this machine last
wrote (`~/.config/csync/state.json`) it applies the preset — **only while the game is
closed**. Games read their config at start-up and rewrite it on exit, so writing while a game
runs would be lost; instead the daemon logs `waiting: <game> is running` and applies as soon as
the process is gone. Process names come from the catalog (`processNames`).

Change the Default from your phone; the PC follows. Switch the Default from "Casual" to
"Tournament" and every PC running `csync watch` has the tournament files before the next
launch. Every write still goes through the same backup as `csync apply`.

`csync watch --install` starts it with your session: a systemd user unit on Linux
(`journalctl --user -u csync-watch -f` for logs), a Startup-folder script on Windows.
`--uninstall` removes it. Free accounts get "Auto-switch is a Pro feature" and exit code 2.

## Launch wrapper (`csync launch`)

For the moment you press Play, the poll can be late. `csync launch <game> -- <command…>`
applies the Default preset and then runs the command, so the files are right when the game
reads them. If the vault is unreachable it says so and launches anyway — it never blocks a game.

- **Steam** → game → Properties → Launch Options: `csync launch cs2 -- %command%`
- **Heroic** → game → Settings → Advanced → Wrapper: `csync launch rocket-league --`

`csync games` prints the exact line for each game it finds.

## Config

`~/.config/csync/config.json` (`$XDG_CONFIG_HOME/csync/config.json`; `%APPDATA%\csync\config.json` on
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
token" until you `csync login` again. Use one token per machine so you can revoke them separately.

## Troubleshooting

| Symptom                                      | Fix                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `<file>: not found on this machine`          | Run the game once so it writes its config; check `csync games` for the path it expects.          |
| Rocket League files not found under Heroic   | Set the game's Wine prefix in Heroic (it lands in `GamesConfig/<app>.json` as `winePrefix`).     |
| Wrong Steam account                          | The most recently used `userdata/<uid>` wins; launch Steam with the right account and try again. |
| `Not logged in`                              | `csync login <url>` — the config file is per user and per machine.                               |
| Applied change gone after launching the game | Steam Cloud restored the old file — see Safety.                                                  |
