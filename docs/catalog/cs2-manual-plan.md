# CS2: what is left after the automatic pass

`cs2-settings-map.md` (GameTracking-CS2 @ 3fc98e7) maps 137 of the catalog's 190 CS2 settings
straight from the game's own layouts and convar dump. This file is the rest: 31 inferred and 22
manual, split into what needs a decision, what needs nothing, and what needs CS2 open.

## Decisions, no game needed

| Setting                                                                                                | Finding                                                                                                                                                                                   | Proposal                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crosshair › Length, Thickness, Gap                                                                     | The menu writes `cl_crosshair_length` / `_thickness` / `_gap` (pixels). The catalog writes `cl_crosshairsize` / `cl_crosshairthickness` / `cl_crosshairgap`, now `hidden` legacy convars. | Switch to the new convars. Old values are a different unit and depend on `cl_crosshair_screen_height`: don't convert, keep existing presets' values as they are. |
| Crosshair › Color                                                                                      | `cl_crosshaircolor` no longer exists; the menu has a colour picker (`cl_crosshaircolor_r/g/b`).                                                                                           | Retire Color from the default preset; Red, Green and Blue (round 3) replace it.                                                                                  |
| Crosshair › Alpha                                                                                      | The catalog writes `cl_crosshairalpha` (hidden).                                                                                                                                          | Move to `cl_crosshaircolor_a` (round 3).                                                                                                                         |
| Crosshair › Outline Thickness, Deployed Weapon Gap                                                     | Their convars no longer exist. Outline is now `cl_crosshair_drawoutline` (None / Full / Half), already mapped.                                                                            | Retire both.                                                                                                                                                     |
| Video › Color Mode, Laptop Power Savings; Keyboard / Mouse › Mouse Acceleration, Reverse Mouse Buttons | In none of the current layouts.                                                                                                                                                           | Check the menu once by eye; if they're gone, retire them.                                                                                                        |
| Audio › Hear My Own Voice                                                                              | `voice_loopback` has no `archive` flag: the game never saves it.                                                                                                                          | Manual-only, never synced.                                                                                                                                       |
| Game › Install Counter-Strike Workshop Tools                                                           | Triggers a download; its convar isn't in the dump.                                                                                                                                        | Not a setting: drop it.                                                                                                                                          |
| Video › Current Video Values Preset                                                                    | A macro that sets the other video settings.                                                                                                                                               | Not synced on its own.                                                                                                                                           |

## Nothing to do

- **13 video settings the catalog already maps by hand** (Display Mode, Resolution, Shadows,
  Textures, Filtering, Shaders, Particles, FSR, Reflex, V-Sync, MSAA, Aspect Ratio, Dynamic
  Shadows). Where the layout lists stored values they agree with the catalog's; the rest use
  several keys or a run-time list, and were checked against real files when they were added.
- **9 per-machine settings** (resolution, refresh rate, display, audio devices, Reflex, G-Sync,
  Anti-Lag, laptop power) are mapped for import but must never be copied from one PC to another
  without the per-PC preset.

## Three rounds in CS2

Each round: `csync discover "Counter-Strike 2"` → change the settings below → quit CS2 →
`csync discover "Counter-Strike 2" --diff`. Every round changes several settings but only one key
the dump doesn't already name, so nothing in the diff is ambiguous.

**Round 1: Video** (press Apply before quitting)

| Change                             | Settles                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| Ambient Occlusion → Medium         | Layout says Medium = 2, catalog says 1                          |
| High Dynamic Range → Performance   | Layout says Performance = 3 / Quality = -1, catalog says 0 / 1  |
| Boost Player Contrast → Disabled   | Confirms `r_player_visibility_mode`                             |
| Brightness → 80 %                  | How the on-screen value maps to `r_fullscreen_gamma` (inverted) |
| AMD Anti-Lag 2.0 → the other value | Its key (the Reflex dropdown relabelled on AMD)                 |

**Round 2: Audio**

| Change                                                                                                      | Settles                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Master Volume → 10 %, Other Player Voice Volume → 35 %, Main Menu Volume → 60 %, Master Music Volume → 85 % | The audio-gain curve from on-screen % to stored value (keys known) |
| Voice / Microphone Mode → Open Mic                                                                          | Its key (the layout says Open Mic stores 2)                        |

If the four points don't make the curve obvious, one more round with 25 / 50 / 75 %.

**Round 3: Crosshair, mouse, lobby**

| Change                                               | Settles                                                  |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Crosshair colour → custom R 12, G 34, B 56, alpha 78 | Confirms `cl_crosshaircolor_r/g/b/a`                     |
| Reverse Mouse → On                                   | Its key (the layout stores `pitch` / `!pitch`)           |
| Friends Lobby Default Permissions → the other value  | Whether any file holds it (its convar isn't in the dump) |

Left after the rounds: Display, Refresh Rate and G-Sync (per machine; one monitor, AMD GPU, fixed
gamescope refresh here), which stay import-only.

## Found along the way

- **37 settings in the game that the catalog doesn't have**, all with their key: most are key
  bindings (grenade slots, radio, autobuy, rebuy, chat wheel…), plus CPU Cores Usage Preference
  and the map-preview magnification. They can join the menu from this report with no testing.
- **Half the mapped convars live in `cs2_machine_convars.vcfg`** (HUD colour, radar, matchmaking
  ping, telemetry, fps_max…), which, unlike the user convars and keys, has no `_lastclouded`
  copy: Steam Cloud doesn't carry it between PCs.
