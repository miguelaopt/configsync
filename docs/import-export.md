# Import / export format

Every export file, revision snapshot and import uses the same JSON document. It is defined once with Zod in [`lib/import-export/schema.ts`](../lib/import-export/schema.ts) — that file is the source of truth; this page describes it.

## Compatibility promise

- `format` is always `"gamesettings-vault"`, `version` is currently `1`.
- New fields are added as optional. Existing fields are never renamed or repurposed.
- `version` is bumped only for breaking changes, and the importer will keep reading older versions.

## Shape

```jsonc
{
  "format": "gamesettings-vault",
  "version": 1,
  "kind": "library", // "library" | "game" | "preset"
  "exportedAt": "2026-09-12T10:00:00.000Z",
  "app": { "name": "ConfigSync", "version": "0.1.0" },
  "games": [
    {
      "name": "Orbital Strike",
      "platforms": ["PC"],
      "tags": ["fps"],
      "accentColor": "#4f8cff", // optional, #rrggbb
      "coverUrl": null, // optional https URL (uploaded covers are not exported)
      "catalogId": null, // optional; set when the game was added from the catalog (e.g. "cs2")
      "notes": null,
      "presets": [
        {
          "name": "Main Setup",
          "description": null,
          "notes": null,
          "tags": [],
          "isDefault": true,
          "categories": [
            {
              "name": "Controls",
              "icon": "gamepad", // optional, a lucide icon name from lib/settings/icons.ts
              "settings": [
                {
                  "name": "Sensitivity",
                  "type": "integer",
                  "value": 8,
                  "min": 1,
                  "max": 20,
                  "step": 1,
                  "unit": null,
                  "defaultValue": 5,
                  "options": null,
                  "description": null,
                  "notes": null,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
```

## Setting types and values

| `type`                                       | `value`                                  |
| -------------------------------------------- | ---------------------------------------- |
| `boolean`                                    | `true` / `false`                         |
| `integer`, `decimal`, `slider`, `percentage` | number (`min`/`max`/`step` optional)     |
| `text`, `long_text`                          | string                                   |
| `dropdown`, `enum`                           | string — one of `options[].value`        |
| `multi_select`                               | string[] — each one of `options[].value` |
| `keybind`, `controller_binding`              | string (e.g. `"Shift"`, `"RT"`)          |
| `color`                                      | `"#rrggbb"`                              |
| `resolution`                                 | `{ "width": 2560, "height": 1440 }`      |
| `info`                                       | string, read-only                        |

`options` is an array of `{ "label": string, "value": string }`.

## Import behaviour

- The file is parsed with Zod. Any problem is reported with a path (`games[0].presets[1].name`) and nothing is written.
- A game whose name matches one you already have is **merged into**: its presets are added alongside the existing ones. Otherwise the game is created. You can also pick a target game on the import page.
- The import page uses **Source → Review → Import**. Upload a ConfigSync JSON file or paste JSON, review the games, presets and settings, then confirm. Preview and comparison do not write anything to the vault.
- Conflicts are matched by the slug generated from the preset name. **Keep both** (the default) adds a numbered copy (`Main Setup (2)`). **Skip duplicates** keeps the current preset. **Replace existing** deletes the matched preset and its snapshot history before importing the replacement; replacing the current default preserves its default role. Deleting a preset also removes any per-PC override pointing to it.
- Choose a strategy for the file, or override individual conflicts with **Keep current**, **Import as copy**, or **Replace current**. **Compare differences** shows current and incoming setting values using the vault's comparison engine, before either is changed. Changing the destination refreshes the conflict preview and clears individual overrides.
- Completed imports appear under **Recent imports**, scoped to the signed-in account in the current browser. Only filenames, preset counts and timestamps are retained locally (up to eight entries); file contents are not stored there. This is browser history, not an account-wide audit log. Skipped-only imports are not recorded.
- Unknown extra fields are ignored; nothing that validates is silently dropped.
- Limits: 500 games/file, 200 presets/game, 200 categories/preset, 1 000 settings/category.

## Game config files

Select a supported catalog game in **Game config**, then choose or drop its files in any order. Filenames are matched against catalog paths, with support for CS2's user/slot variants and `.vcfg` files. Each file reports only values actually read; untouched template values do not inflate the recognised count.

**Review settings** shows the full proposed preset, with values not read from the files explicitly marked **Catalog default**. Import remains disabled when no values can be read. Only **Import preset** saves the result, and the completion step links to it. Importing a game you do not yet own also creates its catalog Default preset, as before.

## Other export formats

`GET /api/export?scope=library|game|preset&id=…&format=json|md|csv`

- **Markdown** — human-readable, one heading per game/preset/category, `- Name: value` lines.
- **CSV** — one row per setting: `game,preset,category,setting,type,value,unit,notes`.

Only JSON can be imported.
