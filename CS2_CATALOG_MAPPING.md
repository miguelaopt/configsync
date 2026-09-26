# Reminder: apply the CS2 mapping to the catalog

Open since 2026-09-26. Delete this file when every box is ticked.

PR #67 extracted, from the game's own files, which convar or bind each CS2 setting in the
catalog writes (`docs/catalog/cs2-settings-map.{md,json}`, `scripts/cs2-extract-settings.ts`).
**`catalog/cs2.json` has not changed yet.** Until it does, presets keep writing the wrong keys
listed below.

## What is wrong in the catalog today (users feel this)

- The crosshair writes the old convars `cl_crosshairsize` / `cl_crosshairthickness` /
  `cl_crosshairgap`. The game's menu uses `cl_crosshair_length` / `_thickness` / `_gap`.
- Crosshair Color, Outline Thickness and Deployed Weapon Gap write convars that no longer exist.
- Ambient Occlusion and HDR save the wrong values: the layout says Medium = 2, Performance = 3
  and Quality = -1.

## Checklist

1. [ ] Merge PR #67. It only adds the extractor and the report; nothing changes for users.
2. [ ] **Decisions, no game needed** (the table in `docs/catalog/cs2-manual-plan.md`). The
       proposal:
   - [ ] Crosshair Length / Thickness / Gap → the new convars. Existing presets keep their values
         (the unit changed; no conversion).
   - [ ] Retire Crosshair Color (replaced by R/G/B), Outline Thickness, Deployed Weapon Gap and
         "Install Counter-Strike Workshop Tools".
   - [ ] Alpha → `cl_crosshaircolor_a`.
   - [ ] Hear My Own Voice → manual only, never synced (the game doesn't save it).
   - [ ] Check by eye that Color Mode, Laptop Power Savings, Mouse Acceleration and Reverse Mouse
         Buttons are still in the menu. If they aren't, retire them.
3. [ ] **PR "apply the CS2 mapping"**: `catalog/cs2.json` gets the 137 settings from the game and
       the decisions above, plus a patch bump and a changelog entry ("CS2 crosshair settings
       apply the way the game reads them now").
4. [ ] **Three rounds in CS2** (Miguel, about 15 min): `csync discover "Counter-Strike 2"` →
       change → quit → `--diff`. What to change in each round (video, audio, crosshair/mouse)
       is in `docs/catalog/cs2-manual-plan.md`. They settle the other 22 settings: the
       brightness and volume curves, Anti-Lag, Open Mic and Reverse Mouse.
5. [ ] Optional: add the 37 settings the game has and the catalog doesn't (mostly binds) to the
       menu. They already come with their keys.
