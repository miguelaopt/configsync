# The game catalog

`catalog/<id>.json` — one file per game, in the export format plus a few catalog-only fields.
Picking a game "From the catalog" imports that file; the web import tab and the companion use
its `files` and `source` mappings to read and write the game's real config files.

The catalog ships two games: Counter-Strike 2 (`cs2`) and Rocket League (`rocket-league`).

## Rules

1. **Exact in-game text.** Category names, setting names and option labels are copied from the
   game's own menu, character for character. The vault should read like the game.
2. **No copying artwork.** Covers are hot-linked from Steam's CDN
   (`https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/header.jpg`); never commit
   screenshots, icons or other game assets.
3. **`source` is catalog-only.** It is stripped on import, never stored in the database and never
   part of the export format. A preset is matched back to the catalog by category name + setting
   name, so renaming a setting in the vault silently drops it from file export.
4. **Files are patched, never generated.** Only keys with a `source` are touched; everything else
   in the user's file stays byte-for-byte.

## Layout

```jsonc
{
  "id": "cs2", // stable, url-safe: [a-z0-9-]
  "steamAppId": 730, // optional; matches `csync scan` and Steam suggestions
  "epicAppName": "Sugar", // optional; Epic/Legendary app name
  "files": [
    {
      "id": "video", // referenced by `source.file`
      "format": "keyvalues", // "keyvalues" (Valve VDF) | "ini"
      "bool": "01", // how booleans are written: "01" | "truefalse" | "TrueFalse"
      "section": [], // KV: object path holding the keys, e.g. ["config", "convars"]; INI: ["SystemSettings"]
      "paths": {
        // per launcher/OS; placeholders are resolved by the companion
        "steam-linux": "{steam_userdata}/730/local/cfg/cs2_video.txt",
        "steam-windows": "{steam_userdata}/730/local/cfg/cs2_video.txt",
      },
    },
  ],
  "name": "Counter-Strike 2",
  "platforms": ["PC"],
  "coverUrl": "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
  "presets": [{ "name": "Default", "isDefault": true, "categories": [/* … */] }],
}
```

Placeholders: `{steam_userdata}` → `<steam>/userdata/<uid>`; `{documents}` → the user's Documents
folder (native, or inside the Proton/Heroic prefix on Linux).

## `source` shapes

Each setting is an ordinary setting document (see [import-export.md](import-export.md)) with an
optional `source`. Settings without one are still in the catalog for manual entry; import reports
them as "not stored in files".

| Shape                                | Use                                                                                                                                                                                                  | Example                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `{ file, key }`                      | Scalar: boolean, number, string or enum. For enums, `options[].value` **is the raw file value** and `label` is the menu text.                                                                        | `{ "file": "video", "key": "setting.mat_vsync" }`                                                                                    |
| `{ file, width, height }`            | Resolution split across two keys.                                                                                                                                                                    | `{ "file": "video", "width": "setting.defaultres", "height": "setting.defaultresheight" }`                                           |
| `{ file, match: [{ value, keys }] }` | Composite enum. Read: first option whose keys all match the file. Write: all keys of the chosen option.                                                                                              | `{ "file": "video", "match": [{ "value": "Fullscreen", "keys": { "setting.fullscreen": "1", "setting.nowindowborder": "0" } }, …] }` |
| `{ file, bind }`                     | CS2 keybind: the value is the key bound to command `bind`. Read: key whose value is the command, else the default. Write: `"<key>" "<command>"` and `"<defaultKey>" "<unbound>"` when the key moved. | `{ "file": "keys", "bind": "toggleconsole" }`                                                                                        |

A file value the mapping can't decode (a number that isn't numeric, an enum value not in
`options`) keeps the catalog default and adds a warning naming the key. On a later apply, that
default is what gets written — so make sure `options` cover every value the game can write.

## Finding keys

Change one setting in the game, quit, and diff the file. CS2 writes only keys that differ from
its defaults to `cs2_user_keys_0_slot0.vcfg`, so a default binding never appears there. Rocket
League repeats keys across `[SystemSettingsBucketN]` sections; only the first
`[SystemSettings]` section is read.

## Testing a new game

- The loader validates every file at startup; `tests/catalog.test.ts` checks that every `source`
  points at a declared file and that the game round-trips through the export schema.
- Put a trimmed copy of each real file (personal bindings removed) in `tests/fixtures/` and add a
  read → write → read round-trip to `tests/game-configs.test.ts`.
- `pnpm csync games` shows whether the companion finds the files on your machine.
