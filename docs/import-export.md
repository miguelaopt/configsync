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
  "app": { "name": "GameSettings Vault", "version": "0.1.0" },
  "games": [
    {
      "name": "Orbital Strike",
      "platforms": ["PC"],
      "tags": ["fps"],
      "accentColor": "#4f8cff", // optional, #rrggbb
      "coverUrl": null, // optional https URL (uploaded covers are not exported)
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
- Presets are always added, never overwritten. A preset name that already exists in that game gets a numbered suffix (`Main Setup (2)`).
- Unknown extra fields are ignored; nothing that validates is silently dropped.
- Limits: 500 games/file, 200 presets/game, 200 categories/preset, 1 000 settings/category.

## Other export formats

`GET /api/export?scope=library|game|preset&id=…&format=json|md|csv`

- **Markdown** — human-readable, one heading per game/preset/category, `- Name: value` lines.
- **CSV** — one row per setting: `game,preset,category,setting,type,value,unit,notes`.

Only JSON can be imported.
