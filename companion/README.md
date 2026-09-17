# csync — ConfigSync companion

A small CLI for your gaming PC. It finds the games you have installed, reads their config
files into your vault as presets, and writes presets back into those files. Plain Node ≥ 20,
no dependencies.

## Install

```sh
git clone <repo> && cd configsync/companion
npm i -g .            # installs the `csync` command
```

From a checkout of the repo you can also run it without installing: `pnpm csync <command>`.

## Commands

| Command                                   | What it does                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `csync login <url>`                       | Pair this machine with your vault. Paste a token from Settings → Companion.   |
| `csync scan [--push]`                     | List installed Steam and Epic games. `--push` sends the list to your vault.   |
| `csync games`                             | List catalog games and whether their config files were found on this machine. |
| `csync import <game> [--name "…"]`        | Read the game's config files into a **new** preset. Never overwrites.         |
| `csync apply <game> <preset> [--dry-run]` | Write a preset into the game's config files. Backs each file up first.        |

`<game>` is a catalog id such as `cs2` or `rocket-league`; `<preset>` is the preset's slug
from its URL. The token can also be piped: `echo $TOKEN | csync login https://vault.example`.

## Where things live

- Config: `~/.config/csync/config.json` (`%APPDATA%\csync\config.json` on Windows), mode 600.
- Backups: next to each file, as `<file>.bak-<timestamp>`. Copy one back to undo an apply.
- Steam files come from the most recently used account under `userdata/`; Proton and
  Heroic prefixes are searched for Windows-only games on Linux.

## Two warnings

1. **Close the game before `import` or `apply`.** Games write their config on exit and would
   overwrite what you just applied.
2. **Steam Cloud may restore old files** for some games. If a change disappears after launch,
   apply again with Cloud sync off for that game.
