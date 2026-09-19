# Project state

Updated: 2026-09-20. Branch: `feat/import-flow`.

## Handoff baseline

The working tree was clean at `12d1e3f` when this handoff began. Neither this file nor `TODO.md` existed. Read `AGENTS.md` and the installed Next.js documentation before changing framework code.

Claude had already implemented the new import page layout, shared 660px dropzone, ConfigSync backup Source → Review → Import flow, server conflict preview, global keep/skip/replace strategies, and game-file detection summary. Recent dashboard and backdrop changes were already committed and are outside this task.

## Current task

Finish the import remodel from the user's design prompt, preserving the existing work:

- Both tabs now show visual progress through Source → Review → Import.
- Game config has a real read-only settings review before confirmation, shows catalog defaults explicitly, and links to the saved preset after import.
- Backup conflicts expose current/import counts, timestamps, individual choices and a read-only comparison using the existing comparison engine.
- Recent imports retain successful-import metadata per account in this browser, labeled accordingly; they are not a server audit log.
- Filename matching handles Rocket League's real filenames and CS2 slot variants. Recognised counts exclude catalog defaults, `.vcfg` is selectable, and zero-value web imports are refused.
- Replacing a default preset preserves its role. The existing destructive replacement semantics remain: history and per-PC overrides of the deleted preset are removed.
- Import docs and desktop/mobile regression coverage have been expanded.

Implementation and local validation are complete. Publication uses PR #32 into `main`, followed by the Docker Compose deployment described in `docs/launch.md`. No migrations or new dependencies were needed. Validation is recorded in `TODO.md`.
