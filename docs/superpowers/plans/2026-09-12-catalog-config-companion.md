# Game Catalog, Config Files, Search & Companion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add games from a catalog that mirrors the real in-game menus (CS2, Rocket League), import/export their on-disk config files, search games by name / installed-on-device, and ship a zero-dependency companion CLI that scans, imports and applies.

**Architecture:** The catalog is JSON in the existing export format plus per-setting `source` mappings; two generic format codecs (Valve KeyValues, INI) plus one mapping module turn files into `PresetDoc`s and patch files back. The web app and the companion share the same server code through `app/api/companion/*` routes authenticated by hashed bearer tokens. Nothing is ever generated from scratch or written without a backup.

**Tech Stack:** Next.js 16 App Router, Drizzle/Postgres, Zod 4, Vitest, Playwright, plain Node ≥20 ESM for the CLI.

**Spec:** `docs/superpowers/specs/2026-09-12-catalog-config-companion-design.md`

## Global Constraints

- Setting names, category names and option labels in the catalog must be **exactly** the in-game text.
- `source` is catalog-only: never stored in the DB, never in the export format.
- Config files are **patched**, never generated; unknown keys stay byte-for-byte.
- Import always creates a new preset; nothing overwrites.
- Companion writes only after a `<file>.bak-<timestamp>` copy exists.
- Companion: no dependencies, Node ≥ 20, ESM `.mjs`.
- Each uploaded config file ≤ 512 KB. Tokens: `gsv_` + 32 random bytes base64url, stored as SHA-256 hex.
- Existing patterns: server actions via `runAction()` in `lib/actions/shared.ts`; data functions take `userId` first; UI primitives from `components/ui`; user-facing errors are sentences.
- Run `pnpm check` (typecheck + lint + unit) before every commit. Commit messages end with the attribution lines from the session reminder.

---

## File map

| Path                                                                                                       | Responsibility                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `catalog/cs2.json`, `catalog/rocket-league.json`                                                           | Game templates (data only)                                                                                  |
| `lib/catalog/schema.ts`                                                                                    | Zod schema for a catalog game (`gameDocSchema` + `id`, ids, `files`, per-setting `source`)                  |
| `lib/catalog/index.ts`                                                                                     | Loads + validates all catalog JSON; `CATALOG`, `getCatalogGame`, `catalogToExportFile`, `publicCatalog`     |
| `lib/game-configs/formats/keyvalues.ts`                                                                    | `parseKeyValues`, `patchKeyValues`                                                                          |
| `lib/game-configs/formats/ini.ts`                                                                          | `parseIni`, `patchIni`                                                                                      |
| `lib/game-configs/index.ts`                                                                                | `readGameConfig`, `writeGameConfig`                                                                         |
| `lib/data/catalog.ts`                                                                                      | `createGameFromCatalog`, `findGameByCatalogId`, `importConfigAsPreset`                                      |
| `lib/data/devices.ts`                                                                                      | `replaceDeviceGames`, `listDeviceGames`                                                                     |
| `lib/data/companion-tokens.ts`                                                                             | `createCompanionToken`, `listCompanionTokens`, `revokeCompanionToken`, `userIdForToken`                     |
| `lib/auth/companion.ts`                                                                                    | `requireCompanionUser(req)`                                                                                 |
| `lib/providers/steam-store.ts`                                                                             | `searchSteamStore(q)`                                                                                       |
| `lib/actions/catalog.ts`                                                                                   | `createGameFromCatalogAction`, `previewGameConfigAction`, `importGameConfigAction`, `patchGameConfigAction` |
| `lib/actions/search-games.ts`                                                                              | `searchGamesAction`                                                                                         |
| `lib/actions/companion.ts`                                                                                 | token create/revoke actions                                                                                 |
| `app/api/companion/{me,catalog,devices,import,apply}/route.ts`                                             | CLI endpoints                                                                                               |
| `components/games/catalog-picker.tsx`                                                                      | "From the catalog" list in the Add-game dialog                                                              |
| `components/games/game-name-suggest.tsx`                                                                   | Name field with device/Steam suggestions                                                                    |
| `components/import-export/game-files-form.tsx`                                                             | Import tab "From game files"                                                                                |
| `components/presets/config-files-dialog.tsx`                                                               | Preset → "Game config files…" upload/patch/download                                                         |
| `components/settings-page/companion-card.tsx`                                                              | Tokens + devices in Settings                                                                                |
| `companion/bin/gsv.mjs`                                                                                    | CLI entry (arg parsing, commands)                                                                           |
| `companion/lib/{config,paths,scan,api}.mjs`                                                                | Config file, path placeholders, launcher scanners, HTTP client                                              |
| `docs/companion.md`, `docs/catalog.md`                                                                     | User + contributor docs                                                                                     |
| `tests/{catalog,keyvalues,ini,game-configs,companion-tokens}.test.ts`                                      | Unit tests                                                                                                  |
| `tests/fixtures/{cs2_video.txt,cs2_user_convars.vcfg,cs2_user_keys.vcfg,TASystemSettings.ini,TAInput.ini}` | Trimmed real files                                                                                          |

---

## Phase 1 — Catalog

### Task 1: Schema changes and migration

**Files:**

- Modify: `lib/db/schema.ts` (games table ~line 145; append two tables after `revisions`)
- Modify: `lib/import-export/schema.ts:60-70` (`gameDocSchema`)
- Create: `drizzle/0001_catalog_companion.sql` (generated)

**Interfaces:**

- Produces: `games.catalogId: string | null`; tables `companionTokens`, `deviceGames`; `GameDoc.catalogId?: string | null`.

- [ ] **Step 1: Add `catalogId` to games and the two new tables**

In `lib/db/schema.ts`, inside the `games` columns after `notes`:

```ts
    /** Id of the catalog template this game was created from (catalog/<id>.json). */
    catalogId: text("catalog_id"),
```

Append after the `revisions` table (before the `relations` block):

```ts
// ---------------------------------------------------------------------------
// Companion CLI: personal access tokens and what it found installed
// ---------------------------------------------------------------------------

export const companionTokens = pgTable(
  "companion_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** sha256 hex of the token; the token itself is shown once and never stored. */
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("companion_tokens_hash_uq").on(t.tokenHash),
    index("companion_tokens_user_idx").on(t.userId),
  ],
);

export const deviceGameSource = pgEnum("device_game_source", ["steam", "epic"]);

export const deviceGames = pgTable(
  "device_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    device: text("device").notNull(),
    source: deviceGameSource("source").notNull(),
    appId: text("app_id").notNull(),
    name: text("name").notNull(),
    installDir: text("install_dir"),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("device_games_uq").on(t.userId, t.device, t.source, t.appId)],
);

export type CompanionToken = typeof companionTokens.$inferSelect;
export type DeviceGame = typeof deviceGames.$inferSelect;
```

- [ ] **Step 2: Add `catalogId` to the export format**

In `lib/import-export/schema.ts`, inside `gameDocSchema` after `notes`:

```ts
  /** Catalog template this game came from; optional and informational. */
  catalogId: z.string().trim().max(60).nullish(),
```

- [ ] **Step 3: Generate the migration and apply it**

Run: `pnpm db:generate` then rename the produced file to `drizzle/0001_catalog_companion.sql` and update its `tag` in `drizzle/meta/_journal.json` to match. Then `pnpm db:migrate`.
Expected: `[gsv] migrations applied`; `psql`-free check: `pnpm exec drizzle-kit check` reports no drift.

- [ ] **Step 4: Typecheck and existing tests**

Run: `pnpm check`
Expected: PASS (the `GameDoc` change is additive; `lib/data/export.ts` needs `catalogId: game.catalogId` added to the object it builds in `toGameDoc`-style code — search `platforms: game.platforms` in `lib/data/export.ts` and add the field there).

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/import-export/schema.ts lib/data/export.ts drizzle
git commit -m "feat(db): games.catalog_id, companion_tokens, device_games"
```

### Task 2: Catalog schema and loader

**Files:**

- Create: `lib/catalog/schema.ts`, `lib/catalog/index.ts`
- Create: `catalog/cs2.json`, `catalog/rocket-league.json` (Task 3 fills them; create minimal valid stubs here)
- Test: `tests/catalog.test.ts`

**Interfaces:**

- Produces:
  - `type SettingSource = { file: string } & ({ key: string } | { width: string; height: string } | { match: { value: string; keys: Record<string,string> }[] } | { bind: string })`
  - `type CatalogFile = { id: string; format: "keyvalues" | "ini"; bool: "01" | "truefalse" | "TrueFalse"; section: string[]; paths: Record<string,string> }`
  - `type CatalogGame = GameDoc & { id: string; steamAppId?: number; epicAppName?: string; files: CatalogFile[]; presets: (PresetDoc & { categories: (CategoryDoc & { settings: (SettingDoc & { source?: SettingSource })[] })[] })[] }`
  - `CATALOG: CatalogGame[]`, `getCatalogGame(id: string): CatalogGame | null`
  - `catalogToExportFile(game: CatalogGame): ExportFile` — strips `id/files/source`, sets `catalogId`
  - `publicCatalog(): { id, name, coverUrl, steamAppId, epicAppName, settingCount, files }[]` — what the CLI and UI list

- [ ] **Step 1: Write the failing test**

`tests/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATALOG, catalogToExportFile, getCatalogGame } from "@/lib/catalog";
import { exportFileSchema } from "@/lib/import-export/schema";

describe("catalog", () => {
  it("contains cs2 and rocket-league", () => {
    expect(CATALOG.map((g) => g.id).sort()).toEqual(["cs2", "rocket-league"]);
  });
  it("every source refers to a declared file", () => {
    for (const g of CATALOG) {
      const fileIds = new Set(g.files.map((f) => f.id));
      for (const p of g.presets)
        for (const c of p.categories)
          for (const s of c.settings) {
            if (s.source)
              expect(fileIds.has(s.source.file), `${g.id}/${c.name}/${s.name}`).toBe(true);
          }
    }
  });
  it("converts to a valid export file without catalog-only fields", () => {
    const file = catalogToExportFile(getCatalogGame("cs2")!);
    expect(exportFileSchema.safeParse(file).success).toBe(true);
    expect(file.games[0]!.catalogId).toBe("cs2");
    expect(JSON.stringify(file)).not.toContain('"source"');
  });
});
```

- [ ] **Step 2: Run it** — `pnpm vitest run tests/catalog.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write `lib/catalog/schema.ts`**

```ts
import { z } from "zod";
import {
  categoryDocSchema,
  gameDocSchema,
  presetDocSchema,
  settingDocSchema,
} from "@/lib/import-export/schema";

const kv = z.record(z.string(), z.string());

export const settingSourceSchema = z.intersection(
  z.object({ file: z.string().min(1) }),
  z.union([
    z.object({ key: z.string().min(1) }),
    z.object({ width: z.string().min(1), height: z.string().min(1) }),
    z.object({ match: z.array(z.object({ value: z.string(), keys: kv })).min(1) }),
    z.object({ bind: z.string().min(1) }),
  ]),
);
export type SettingSource = z.infer<typeof settingSourceSchema>;

export const catalogFileSchema = z.object({
  id: z.string().min(1),
  format: z.enum(["keyvalues", "ini"]),
  bool: z.enum(["01", "truefalse", "TrueFalse"]),
  section: z.array(z.string()).default([]),
  paths: z.record(
    z.enum(["steam-linux", "steam-windows", "epic-linux", "epic-windows"]),
    z.string(),
  ),
});
export type CatalogFile = z.infer<typeof catalogFileSchema>;

const catalogSettingSchema = settingDocSchema.extend({ source: settingSourceSchema.optional() });
const catalogCategorySchema = categoryDocSchema.extend({ settings: z.array(catalogSettingSchema) });
const catalogPresetSchema = presetDocSchema.extend({ categories: z.array(catalogCategorySchema) });

export const catalogGameSchema = gameDocSchema.extend({
  id: z.string().regex(/^[a-z0-9-]+$/),
  steamAppId: z.number().int().positive().optional(),
  epicAppName: z.string().optional(),
  files: z.array(catalogFileSchema).default([]),
  presets: z.array(catalogPresetSchema).min(1),
});
export type CatalogGame = z.infer<typeof catalogGameSchema>;
export type CatalogSetting = z.infer<typeof catalogSettingSchema>;
```

- [ ] **Step 4: Write `lib/catalog/index.ts`**

```ts
import cs2 from "@/catalog/cs2.json";
import rocketLeague from "@/catalog/rocket-league.json";
import { catalogGameSchema, type CatalogGame } from "./schema";
import { buildExportFile } from "@/lib/import-export/serialize";
import type { ExportFile, GameDoc } from "@/lib/import-export/schema";

export * from "./schema";

/** Add a game: drop its JSON in catalog/ and import it here. Validated once at module load. */
export const CATALOG: CatalogGame[] = [cs2, rocketLeague].map((raw) => {
  const parsed = catalogGameSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      `Invalid catalog entry: ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`,
    );
  return parsed.data;
});

export function getCatalogGame(id: string): CatalogGame | null {
  return CATALOG.find((g) => g.id === id) ?? null;
}

/** The catalog entry as a plain GameDoc: catalog-only fields removed, catalogId set. */
export function catalogToGameDoc(game: CatalogGame): GameDoc {
  const { id, files: _files, steamAppId: _s, epicAppName: _e, presets, ...rest } = game;
  return {
    ...rest,
    catalogId: id,
    presets: presets.map((p) => ({
      ...p,
      categories: p.categories.map((c) => ({
        ...c,
        settings: c.settings.map(({ source: _source, ...s }) => s),
      })),
    })),
  };
}

export function catalogToExportFile(game: CatalogGame): ExportFile {
  return buildExportFile([catalogToGameDoc(game)], "game");
}

/** Lightweight listing for the Add-game dialog and the CLI. */
export function publicCatalog() {
  return CATALOG.map((g) => ({
    id: g.id,
    name: g.name,
    coverUrl: g.coverUrl ?? null,
    accentColor: g.accentColor ?? null,
    steamAppId: g.steamAppId ?? null,
    epicAppName: g.epicAppName ?? null,
    settingCount: g.presets[0]!.categories.reduce((n, c) => n + c.settings.length, 0),
    files: g.files,
  }));
}
export type PublicCatalogEntry = ReturnType<typeof publicCatalog>[number];
```

Create stub `catalog/cs2.json` and `catalog/rocket-league.json` so the loader runs (Task 3 replaces them):

```json
{
  "id": "cs2",
  "name": "Counter-Strike 2",
  "steamAppId": 730,
  "platforms": ["PC"],
  "tags": ["fps", "competitive"],
  "accentColor": "#e9b44c",
  "coverUrl": "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
  "files": [],
  "presets": [{ "name": "Default", "isDefault": true, "categories": [] }]
}
```

(Rocket League: `"id": "rocket-league"`, `"name": "Rocket League"`, `"steamAppId": 252950`, `"epicAppName": "Sugar"`, cover `.../apps/252950/header.jpg`, accent `#6fa8ff`.)

- [ ] **Step 5: Run tests** — `pnpm vitest run tests/catalog.test.ts` → PASS. `pnpm check` → PASS.

- [ ] **Step 6: Commit** — `git add catalog lib/catalog tests/catalog.test.ts && git commit -m "feat(catalog): schema, loader and stub entries"`

### Task 3: Catalog content — CS2 and Rocket League

**Files:**

- Replace: `catalog/cs2.json`, `catalog/rocket-league.json`
- Test: `tests/catalog.test.ts` (existing tests must still pass; add the two assertions below)

Every setting below is a `settingDoc` (`name`, `type`, `value` = default, `defaultValue` same, plus `min/max/step/unit/options`) with an optional `source`. Option `value` is the raw file value, `label` the in-game text. Settings listed **without** a source are manual-entry (not stored in text files) — include them anyway; the menu is the contract.

- [ ] **Step 1: Add assertions to `tests/catalog.test.ts`**

```ts
it("cs2 maps resolution, display mode and a keybind", () => {
  const cs2 = getCatalogGame("cs2")!;
  const all = cs2.presets[0]!.categories.flatMap((c) =>
    c.settings.map((s) => ({ ...s, category: c.name })),
  );
  const res = all.find((s) => s.name === "Resolution")!;
  expect(res.source).toEqual({
    file: "video",
    width: "setting.defaultres",
    height: "setting.defaultresheight",
  });
  expect(all.find((s) => s.name === "Display Mode")!.source).toHaveProperty("match");
  expect(all.find((s) => s.name === "Fire")!.source).toEqual({ file: "keys", bind: "+attack" });
  expect(cs2.files.map((f) => f.id)).toEqual(["video", "convars", "keys"]);
});
it("rocket league marks camera settings as manual", () => {
  const rl = getCatalogGame("rocket-league")!;
  const camera = rl.presets[0]!.categories.find((c) => c.name === "Camera")!;
  expect(camera.settings.every((s) => !s.source)).toBe(true);
  expect(rl.files.map((f) => f.id)).toEqual(["video", "input"]);
});
```

- [ ] **Step 2: Run** — FAIL (stubs have no categories).

- [ ] **Step 3: Write `catalog/cs2.json`**

Top level: `id "cs2"`, `name "Counter-Strike 2"`, `steamAppId 730`, `platforms ["PC"]`, `tags ["fps","competitive","valve"]`, `accentColor "#e9b44c"`, `coverUrl "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg"`, `notes null`, one preset `{ "name": "Default", "isDefault": true, "tags": [], "categories": [...] }`.

`files`:

```json
[
  {
    "id": "video",
    "format": "keyvalues",
    "bool": "01",
    "section": ["video.cfg"],
    "paths": {
      "steam-linux": "{steam_userdata}/730/local/cfg/cs2_video.txt",
      "steam-windows": "{steam_userdata}/730/local/cfg/cs2_video.txt"
    }
  },
  {
    "id": "convars",
    "format": "keyvalues",
    "bool": "truefalse",
    "section": ["config", "convars"],
    "paths": {
      "steam-linux": "{steam_userdata}/730/local/cfg/cs2_user_convars_0_slot0.vcfg",
      "steam-windows": "{steam_userdata}/730/local/cfg/cs2_user_convars_0_slot0.vcfg"
    }
  },
  {
    "id": "keys",
    "format": "keyvalues",
    "bool": "01",
    "section": ["config", "bindings"],
    "paths": {
      "steam-linux": "{steam_userdata}/730/local/cfg/cs2_user_keys_0_slot0.vcfg",
      "steam-windows": "{steam_userdata}/730/local/cfg/cs2_user_keys_0_slot0.vcfg"
    }
  }
]
```

Categories (icons from `lib/settings/icons.ts` names: `monitor`, `mouse`, `keyboard`, `crosshair`, `radar`, `layout-dashboard`, `volume-2`):

**Video** (`icon: "monitor"`)

| name                             | type       | options / range                                                                                              | default          | source                                                                                                                                                                                                                                                                          |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brightness                       | slider     | 50–130 step 1, unit `%`                                                                                      | 100              | —                                                                                                                                                                                                                                                                               |
| Color Mode                       | dropdown   | Computer Monitor, Television                                                                                 | Computer Monitor | —                                                                                                                                                                                                                                                                               |
| Display Mode                     | dropdown   | Fullscreen, Fullscreen Windowed, Windowed                                                                    | Fullscreen       | `{ "file":"video", "match":[ {"value":"Fullscreen","keys":{"setting.fullscreen":"1"}}, {"value":"Fullscreen Windowed","keys":{"setting.fullscreen":"0","setting.nowindowborder":"1"}}, {"value":"Windowed","keys":{"setting.fullscreen":"0","setting.nowindowborder":"0"}} ] }` |
| Aspect Ratio                     | dropdown   | `0` Normal 4:3, `1` Widescreen 16:9, `2` Widescreen 16:10                                                    | 1                | `{file:"video", key:"setting.aspectratiomode"}`                                                                                                                                                                                                                                 |
| Resolution                       | resolution | —                                                                                                            | 1920×1080        | `{file:"video", width:"setting.defaultres", height:"setting.defaultresheight"}`                                                                                                                                                                                                 |
| Refresh Rate                     | integer    | unit `Hz`                                                                                                    | 0 (auto)         | —                                                                                                                                                                                                                                                                               |
| Laptop Power Savings             | boolean    |                                                                                                              | false            | —                                                                                                                                                                                                                                                                               |
| NVIDIA Reflex Low Latency        | dropdown   | `0` Disabled, `1` Enabled, `2` Enabled + Boost                                                               | 0                | `{file:"video", key:"setting.r_low_latency"}`                                                                                                                                                                                                                                   |
| Wait for Vertical Sync           | boolean    |                                                                                                              | false            | `{file:"video", key:"setting.mat_vsync"}`                                                                                                                                                                                                                                       |
| Multisampling Anti-Aliasing Mode | dropdown   | None, CMAA2, 2x MSAA, 4x MSAA, 8x MSAA                                                                       | 4x MSAA          | `match`: None `{msaa_samples:"0", r_csgo_cmaa_enable:"0"}`, CMAA2 `{msaa_samples:"0", r_csgo_cmaa_enable:"1"}`, 2x `{"2","0"}`, 4x `{"4","0"}`, 8x `{"8","0"}` (keys prefixed `setting.`)                                                                                       |
| Global Shadow Quality            | dropdown   | `0` Low, `1` Medium, `2` High, `3` Very High                                                                 | 2                | `setting.videocfg_shadow_quality`                                                                                                                                                                                                                                               |
| Dynamic Shadows                  | dropdown   | `0` Sun Only, `1` All                                                                                        | 1                | `setting.videocfg_dynamic_shadows`                                                                                                                                                                                                                                              |
| Model / Texture Detail           | dropdown   | `0` Low, `1` Medium, `2` High                                                                                | 2                | `setting.videocfg_texture_detail`                                                                                                                                                                                                                                               |
| Texture Filtering Mode           | dropdown   | `0` Bilinear, `1` Trilinear, `2` Anisotropic 2x, `3` Anisotropic 4x, `4` Anisotropic 8x, `5` Anisotropic 16x | 3                | `setting.r_texturefilteringquality`                                                                                                                                                                                                                                             |
| Shader Detail                    | dropdown   | `0` Low, `1` High                                                                                            | 1                | `setting.shaderquality`                                                                                                                                                                                                                                                         |
| Particle Detail                  | dropdown   | `0` Low, `1` Medium, `2` High, `3` Very High                                                                 | 2                | `setting.videocfg_particle_detail`                                                                                                                                                                                                                                              |
| Ambient Occlusion                | dropdown   | `0` Disabled, `1` Medium, `2` High                                                                           | 2                | `setting.videocfg_ao_detail`                                                                                                                                                                                                                                                    |
| High Dynamic Range               | dropdown   | `0` Performance, `1` Quality                                                                                 | 1                | `setting.videocfg_hdr_detail`                                                                                                                                                                                                                                                   |
| FidelityFX Super Resolution      | dropdown   | `0` Disabled (Highest Quality), `1` Ultra Quality, `2` Quality, `3` Balanced, `4` Performance                | 0                | `setting.videocfg_fsr_detail`                                                                                                                                                                                                                                                   |
| Maximum FPS In Game              | integer    | 0 = unlimited                                                                                                | 0                | —                                                                                                                                                                                                                                                                               |
| Maximum FPS In Menus             | integer    |                                                                                                              | 120              | —                                                                                                                                                                                                                                                                               |

**Keyboard / Mouse** (`icon: "mouse"`)

| name                        | type     | range                  | default | source                                           |
| --------------------------- | -------- | ---------------------- | ------- | ------------------------------------------------ |
| Mouse Sensitivity           | decimal  | 0.01–20 step 0.01      | 2.5     | `{file:"convars", key:"sensitivity"}`            |
| Zoom Sensitivity Multiplier | decimal  | 0.1–3 step 0.01        | 1       | `{file:"convars", key:"zoom_sensitivity_ratio"}` |
| Mouse Acceleration          | dropdown | Off, Legacy, Precision | Off     | —                                                |
| Reverse Mouse Buttons       | boolean  |                        | false   | —                                                |

**Keybinds** (`icon: "keyboard"`) — all `type: "keybind"`, `source: { "file": "keys", "bind": <command> }`, `value`/`defaultValue` = default key:

| name               | command         | default    |
| ------------------ | --------------- | ---------- |
| Move Forward       | `+forward`      | w          |
| Move Left          | `+left`         | a          |
| Move Back          | `+back`         | s          |
| Move Right         | `+right`        | d          |
| Walk               | `+sprint`       | shift      |
| Jump               | `+jump`         | space      |
| Duck               | `+duck`         | ctrl       |
| Fire               | `+attack`       | mouse1     |
| Secondary Fire     | `+attack2`      | mouse2     |
| Reload             | `+reload`       | r          |
| Use                | `+use`          | e          |
| Drop Weapon        | `drop`          | g          |
| Inspect Weapon     | `+lookatweapon` | f          |
| Switch Hands       | `switchhands`   | h          |
| Primary Weapon     | `slot1`         | 1          |
| Secondary Weapon   | `slot2`         | 2          |
| Melee Weapon       | `slot3`         | 3          |
| Cycle Grenades     | `slot4`         | 4          |
| Explosives & Traps | `slot5`         | 5          |
| Previous Weapon    | `invprev`       | mwheelup   |
| Next Weapon        | `invnext`       | mwheeldown |
| Last Weapon Used   | `lastinv`       | q          |
| Buy Menu           | `buymenu`       | b          |
| Scoreboard         | `+showscores`   | tab        |
| Chat Message       | `messagemode`   | y          |
| Team Message       | `messagemode2`  | u          |
| Use Microphone     | `+voicerecord`  | k          |
| Player Ping        | `player_ping`   | mouse3     |
| Graffiti Menu      | `+spray_menu`   | t          |
| Toggle Console     | `toggleconsole` | `          |

**Crosshair** (`icon: "crosshair"`, file `convars`)

| name                   | type     | options / range                                                                                   | default | key                              |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------- | ------- | -------------------------------- |
| Crosshair Style        | dropdown | `0` Default, `1` Default Static, `2` Classic, `3` Classic Dynamic, `4` Classic Static, `5` Legacy | 4       | `cl_crosshairstyle`              |
| Follow Recoil          | boolean  |                                                                                                   | false   | `cl_crosshair_recoil`            |
| Center Dot             | boolean  |                                                                                                   | false   | `cl_crosshairdot`                |
| Length                 | decimal  | 0–10 step 0.1                                                                                     | 5       | `cl_crosshairsize`               |
| Thickness              | decimal  | 0–5 step 0.1                                                                                      | 0.5     | `cl_crosshairthickness`          |
| Gap                    | decimal  | -5–5 step 0.1                                                                                     | 1       | `cl_crosshairgap`                |
| Outline                | boolean  |                                                                                                   | true    | `cl_crosshair_drawoutline`       |
| Outline Thickness      | decimal  | 0–3 step 0.1                                                                                      | 1       | `cl_crosshair_outlinethickness`  |
| Color                  | dropdown | `0` Red, `1` Green, `2` Yellow, `3` Blue, `4` Cyan, `5` Custom                                    | 1       | `cl_crosshaircolor`              |
| Alpha                  | integer  | 0–255                                                                                             | 200     | `cl_crosshairalpha`              |
| T Style                | boolean  |                                                                                                   | false   | `cl_crosshair_t`                 |
| Deployed Weapon Gap    | boolean  |                                                                                                   | true    | `cl_crosshairgap_useweaponvalue` |
| Sniper Crosshair Width | decimal  | 1–3 step 0.1                                                                                      | 1       | `cl_crosshair_sniper_width`      |

**Radar** (`icon: "radar"`, file `convars`): Radar Centers The Player (boolean, true, `cl_radar_always_centered`), Radar Is Rotating (boolean, true, `cl_radar_rotate`), Radar HUD Size (decimal 0.8–1.3 step 0.05, 1, `cl_hud_radar_scale`), Radar Map Zoom (decimal 0.25–1 step 0.05, 0.7, `cl_radar_scale`), Toggle Shape With Scoreboard (boolean, true, `cl_radar_square_with_scoreboard`).

**HUD** (`icon: "layout-dashboard"`, file `convars`): HUD Scale (decimal 0.5–0.95 step 0.01, 0.95, `hud_scaling`), HUD Color (dropdown `0` Default … `10` Pink: Default, White, Light Blue, Blue, Purple, Red, Orange, Yellow, Green, Aqua, Pink; default 0, `cl_hud_color`).

**Audio** (`icon: "volume-2"`): Master Volume (decimal 0–1 step 0.01, 1, `{file:"convars", key:"volume"}`), Audio Device (text, "Default"), EQ Profile (dropdown Crisp/Smooth/Natural, Natural), L/R Isolation (percentage 0–100, 50), Perspective Correction (boolean, true), Enable Voice (dropdown Press to use mic / Open mic / Not enabled, Press to use mic). Only Master Volume has a source.

- [ ] **Step 4: Write `catalog/rocket-league.json`**

Top level: `id "rocket-league"`, `name "Rocket League"`, `steamAppId 252950`, `epicAppName "Sugar"`, `platforms ["PC"]`, `tags ["sports","cars","competitive"]`, `accentColor "#6fa8ff"`, `coverUrl ".../apps/252950/header.jpg"`.

`files`:

```json
[
  {
    "id": "video",
    "format": "ini",
    "bool": "TrueFalse",
    "section": ["SystemSettings"],
    "paths": {
      "epic-linux": "{documents}/My Games/Rocket League/TAGame/Config/TASystemSettings.ini",
      "epic-windows": "{documents}/My Games/Rocket League/TAGame/Config/TASystemSettings.ini",
      "steam-linux": "{documents}/My Games/Rocket League/TAGame/Config/TASystemSettings.ini",
      "steam-windows": "{documents}/My Games/Rocket League/TAGame/Config/TASystemSettings.ini"
    }
  },
  {
    "id": "input",
    "format": "ini",
    "bool": "TrueFalse",
    "section": ["TAGame.PlayerInput_TA"],
    "paths": {
      "epic-linux": "{documents}/My Games/Rocket League/TAGame/Config/TAInput.ini",
      "epic-windows": "{documents}/My Games/Rocket League/TAGame/Config/TAInput.ini",
      "steam-linux": "{documents}/My Games/Rocket League/TAGame/Config/TAInput.ini",
      "steam-windows": "{documents}/My Games/Rocket League/TAGame/Config/TAInput.ini"
    }
  }
]
```

**Video** (`icon: "monitor"`, file `video`)

| name                  | type       | options / range                      | default      | source                                                                                                                                                                   |
| --------------------- | ---------- | ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resolution            | resolution |                                      | 1920×1080    | `{width:"ResX", height:"ResY"}`                                                                                                                                          |
| Display Mode          | dropdown   | Fullscreen, Borderless, Windowed     | Fullscreen   | `match`: Fullscreen `{Fullscreen:"True", Borderless:"False"}`, Borderless `{Fullscreen:"False", Borderless:"True"}`, Windowed `{Fullscreen:"False", Borderless:"False"}` |
| Vertical Sync         | boolean    |                                      | false        | `UseVsync`                                                                                                                                                               |
| Render Quality        | dropdown   | Performance, Quality, High Quality   | High Quality | —                                                                                                                                                                        |
| Render Detail         | dropdown   | Performance, Quality, High Quality   | High Quality | —                                                                                                                                                                        |
| FPS                   | dropdown   | 30, 60, 120, 144, 240, 250, Uncapped | 60           | —                                                                                                                                                                        |
| Anti-Aliasing         | dropdown   | Off, FXAA Low, FXAA High, MLAA, SMAA | Off          | —                                                                                                                                                                        |
| Texture Detail        | dropdown   | Low, Medium, High, High Quality      | High Quality | —                                                                                                                                                                        |
| World Detail          | dropdown   | Performance, Quality, High Quality   | High Quality | —                                                                                                                                                                        |
| Particle Detail       | dropdown   | Low, Medium, High                    | High         | —                                                                                                                                                                        |
| Effect Intensity      | dropdown   | Low, Medium, High                    | High         | —                                                                                                                                                                        |
| High Quality Shaders  | boolean    |                                      | true         | —                                                                                                                                                                        |
| Ambient Occlusion     | boolean    |                                      | true         | `AmbientOcclusion`                                                                                                                                                       |
| Depth of Field        | boolean    |                                      | true         | `DepthOfField`                                                                                                                                                           |
| Bloom                 | boolean    |                                      | true         | `Bloom`                                                                                                                                                                  |
| Light Shafts          | boolean    |                                      | true         | `bAllowLightShafts`                                                                                                                                                      |
| Lens Flares           | boolean    |                                      | true         | `LensFlares`                                                                                                                                                             |
| Dynamic Shadows       | boolean    |                                      | true         | `DynamicShadows`                                                                                                                                                         |
| Motion Blur           | boolean    |                                      | true         | `MotionBlur`                                                                                                                                                             |
| Weather Effects       | boolean    |                                      | true         | —                                                                                                                                                                        |
| Transparent Goalposts | boolean    |                                      | true         | —                                                                                                                                                                        |

**Camera** (`icon: "camera"`) — all manual: Camera Shake (boolean, false), Field of View (integer 60–110, 90), Distance (integer 100–400 step 10, 270), Height (integer 40–200 step 10, 110), Angle (integer -15–0, -3), Stiffness (decimal 0–1 step 0.05, 0.5), Swivel Speed (decimal 1–10 step 0.1, 5), Transition Speed (decimal 1–2 step 0.1, 1), Invert Swivel (boolean, false), Ball Camera Mode (dropdown Toggle/Hold, Toggle).

**Controls** (`icon: "gamepad-2"`): Steering Sensitivity (decimal 1–10 step 0.05, 1), Aerial Sensitivity (decimal 1–10 step 0.05, 1), Controller Deadzone (decimal 0.05–0.5 step 0.01, 0.2), Dodge Deadzone (decimal 0.1–0.9 step 0.01, 0.5), Controller Vibration (boolean, true), Vibration Intensity (percentage 0–100, 100), Ball Cam Indicator (boolean, true), Mouse Sensitivity (integer 1–100, 10, `{file:"input", key:"MouseSensitivity"}`).

**Audio** (`icon: "volume-2"`, manual, all `percentage` 0–100 default 100): Master Volume, Gameplay Volume, Game Music Volume, Music Volume, Crowd Volume, Ambient Volume.

- [ ] **Step 5: Run** — `pnpm vitest run tests/catalog.test.ts` → PASS. Also `pnpm exec prettier --write catalog`.

- [ ] **Step 6: Commit** — `git add catalog tests/catalog.test.ts && git commit -m "feat(catalog): Counter-Strike 2 and Rocket League templates"`

### Task 4: "From the catalog" in the Add-game dialog

**Files:**

- Create: `lib/data/catalog.ts`, `lib/actions/catalog.ts`, `components/games/catalog-picker.tsx`
- Modify: `components/games/game-dialog.tsx:35-50` (dialog body), `components/games/game-header.tsx` (badge), `e2e/vault.spec.ts`

**Interfaces:**

- Produces: `createGameFromCatalog(userId, catalogId): Promise<{ id; slug; name }>`; `findGameByCatalogId(userId, catalogId): Promise<Game | null>`; `createGameFromCatalogAction(catalogId: string): ActionResult<{ id; slug }>`.

- [ ] **Step 1: `lib/data/catalog.ts`**

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { catalogToGameDoc, getCatalogGame } from "@/lib/catalog";
import { importFile } from "@/lib/data/import";
import { AppError } from "./errors";

export async function findGameByCatalogId(userId: string, catalogId: string) {
  return db.query.games.findFirst({
    where: and(
      eq(schema.games.userId, userId),
      eq(schema.games.catalogId, catalogId),
      eq(schema.games.isArchived, false),
    ),
  });
}

/** Creates the game + its Default preset from the catalog. Always creates; callers decide whether to reuse. */
export async function createGameFromCatalog(userId: string, catalogId: string) {
  const entry = getCatalogGame(catalogId);
  if (!entry) throw new AppError("That game isn't in the catalog.");
  const doc = catalogToGameDoc(entry);
  const outcome = await importFile(userId, {
    format: "gamesettings-vault",
    version: 1,
    kind: "game",
    games: [doc],
  });
  const created = outcome.createdGames[0];
  if (!created) throw new AppError(`You already have "${entry.name}". Open it from your library.`);
  await db.update(schema.games).set({ catalogId }).where(eq(schema.games.id, created.id));
  return created;
}
```

Note `importFile` merges into an existing game with the same slug (see `lib/data/import.ts:36`); in that case `createdGames` is empty and we refuse rather than silently adding a second Default preset.

- [ ] **Step 2: `lib/actions/catalog.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createGameFromCatalog } from "@/lib/data/catalog";
import { runAction } from "./shared";

export async function createGameFromCatalogAction(catalogId: string) {
  return runAction(z.object({ catalogId: z.string().min(1) }), { catalogId }, async (v, userId) => {
    const game = await createGameFromCatalog(userId, v.catalogId);
    revalidatePath("/", "layout");
    return { id: game.id, slug: game.slug };
  });
}
```

- [ ] **Step 3: `components/games/catalog-picker.tsx`**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createGameFromCatalogAction } from "@/lib/actions/catalog";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { Spinner } from "@/components/ui/spinner";
import { plural } from "@/lib/utils/format";

/** One row per catalog game; clicking creates it with the real menu structure and opens it. */
export function CatalogPicker({
  entries,
  onDone,
}: {
  entries: PublicCatalogEntry[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const pick = (id: string) => {
    setPendingId(id);
    void createGameFromCatalogAction(id).then((result) => {
      setPendingId(null);
      if (!result.ok) return toast.error(result.error);
      toast.success("Game added with its real settings menu");
      onDone();
      router.push(`/games/${result.data.slug}`);
    });
  };
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Games in the catalog">
      {entries.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            disabled={pendingId != null}
            onClick={() => pick(e.id)}
            className="menu-row flex w-full items-center gap-3 rounded-sm border border-line p-2 text-left hover:border-line-strong"
            style={{ "--accent": e.accentColor ?? undefined } as React.CSSProperties}
          >
            {e.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.coverUrl} alt="" className="h-10 w-20 rounded-xs object-cover" />
            ) : null}
            <span className="flex flex-col">
              <span className="text-[13px] font-medium text-ink">{e.name}</span>
              <span className="text-xs text-ink-3">
                {plural(e.settingCount, "setting")} · real menu names
              </span>
            </span>
            {pendingId === e.id ? <Spinner className="ml-auto" /> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

Check `plural` exists in `lib/utils/format.ts` (it is imported by `import-form.tsx`, so yes) and `Spinner` accepts `className`.

- [ ] **Step 4: Wire into the dialog**

`GameDialog` is a client component; the catalog list must come from the server. Add a prop `catalog?: PublicCatalogEntry[]` to `GameDialog` and `NewGameButton` (`components/games/new-game-button.tsx`) and pass `publicCatalog()` from the server pages that render `NewGameButton` (`app/(app)/games/page.tsx`, `app/(app)/dashboard/page.tsx`, and the empty state — search for `<NewGameButton`). In `GameDialog`, when `!game && catalog?.length`, render above the form:

```tsx
<div className="mb-5 flex flex-col gap-2">
  <p className="text-[13px] font-medium text-ink">From the catalog</p>
  <CatalogPicker entries={catalog} onDone={() => onOpenChange(false)} />
  <p className="text-xs text-ink-3">Or create any game by hand below.</p>
</div>
```

Change the dialog description to `"Pick a game from the catalog to get its real settings menu, or define your own."`.

- [ ] **Step 5: Badge on the game page**

In `components/games/game-header.tsx`, where the platforms/tags badges render, add when `game.catalogId`: `<Badge>Catalog · {game.catalogId}</Badge>` (`Badge` from `components/ui/badge`).

- [ ] **Step 6: E2E**

Append to the library-flow test in `e2e/vault.spec.ts`, before "Archive + delete":

```ts
// --- Add from catalog ----------------------------------------------------
await page.goto("/games");
await page.getByRole("button", { name: "Add game" }).first().click();
await page.getByRole("button", { name: /Counter-Strike 2/ }).click();
await page.waitForURL("**/games/counter-strike-2");
await page.getByText("Default", { exact: true }).click();
await page.waitForURL("**/games/counter-strike-2/default");
await expect(page.getByRole("heading", { name: "Video" })).toBeVisible();
await expect(page.getByText("Multisampling Anti-Aliasing Mode")).toBeVisible();
```

- [ ] **Step 7: Verify** — `pnpm check` PASS; `pnpm exec playwright test --project=desktop` PASS.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(catalog): add games from the catalog with their real menu structure"`

## Phase 2 — Config files

### Task 5: Valve KeyValues codec

**Files:**

- Create: `lib/game-configs/formats/keyvalues.ts`
- Create: `tests/fixtures/cs2_video.txt`, `tests/fixtures/cs2_user_convars.vcfg`, `tests/fixtures/cs2_user_keys.vcfg`
- Test: `tests/keyvalues.test.ts`

**Interfaces:**

- Produces: `type KVNode = { [key: string]: string | KVNode }`; `parseKeyValues(text: string): KVNode`; `patchKeyValues(text: string, section: string[], updates: Record<string, string>): string`.

- [ ] **Step 1: Fixtures** — copy from this machine, trimmed (keep the structure; drop nothing sensitive—these contain no personal data beyond `name`, remove that line):

`tests/fixtures/cs2_video.txt` (first 12 lines of `~/.steam/steam/userdata/*/730/local/cfg/cs2_video.txt` plus the `setting.fullscreen`, `setting.nowindowborder`, `setting.mat_vsync`, `setting.msaa_samples`, `setting.r_csgo_cmaa_enable`, `setting.videocfg_shadow_quality`, `setting.aspectratiomode`, `setting.r_low_latency` lines and the closing brace). `tests/fixtures/cs2_user_convars.vcfg`: the `"config" { "convars" { … } }` wrapper with `sensitivity`, `zoom_sensitivity_ratio`, `cl_crosshairsize`, `cl_crosshair_drawoutline`, `cl_crosshaircolor`, `cl_crosshairalpha`, `volume` lines. `tests/fixtures/cs2_user_keys.vcfg`: exactly

```
"config"
{
	"bindings"
	{
		"p"		"toggleconsole"
		"`"		"<unbound>"
	}
	"analogbindings"
	{
		"MOUSE_X"		"yaw"
	}
}
```

- [ ] **Step 2: Failing test** — `tests/keyvalues.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseKeyValues, patchKeyValues } from "@/lib/game-configs/formats/keyvalues";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

describe("keyvalues", () => {
  it("parses nested objects and quoted strings", () => {
    const doc = parseKeyValues(fx("cs2_user_keys.vcfg")) as {
      config: { bindings: Record<string, string> };
    };
    expect(doc.config.bindings.p).toBe("toggleconsole");
    expect(doc.config.bindings["`"]).toBe("<unbound>");
  });
  it("parses the video file root object", () => {
    const doc = parseKeyValues(fx("cs2_video.txt")) as { "video.cfg": Record<string, string> };
    expect(doc["video.cfg"]["setting.defaultres"]).toBe("1280");
  });
  it("patches existing keys in place and appends new ones, byte-for-byte elsewhere", () => {
    const src = fx("cs2_video.txt");
    const out = patchKeyValues(src, ["video.cfg"], {
      "setting.defaultres": "1920",
      "setting.brand_new": "7",
    });
    expect(out).toContain('"setting.defaultres"\t\t"1920"');
    expect(out).toContain('"setting.brand_new"\t\t"7"');
    expect(out.replace(/"1920"/, '"1280"').replace(/\t"setting.brand_new"\t\t"7"\n/, "")).toBe(src);
  });
  it("patches a nested section", () => {
    const out = patchKeyValues(fx("cs2_user_keys.vcfg"), ["config", "bindings"], {
      w: "+forward",
      p: "<unbound>",
    });
    const doc = parseKeyValues(out) as {
      config: { bindings: Record<string, string>; analogbindings: Record<string, string> };
    };
    expect(doc.config.bindings.w).toBe("+forward");
    expect(doc.config.bindings.p).toBe("<unbound>");
    expect(doc.config.analogbindings.MOUSE_X).toBe("yaw");
  });
  it("ignores // comments", () => {
    expect(parseKeyValues('// hi\n"a" { "b" "c" // trailing\n }')).toEqual({ a: { b: "c" } });
  });
});
```

- [ ] **Step 3: Run** — FAIL (module not found).

- [ ] **Step 4: Implement `lib/game-configs/formats/keyvalues.ts`**

```ts
/**
 * Valve KeyValues (VDF) — the format of CS2's cfg/vcfg files.
 *   "key"  "value"
 *   "key"  { nested }
 * Parsing is tolerant; patching rewrites only the values we touch.
 */
export type KVNode = { [key: string]: string | KVNode };

type Tok = { text: string; start: number; end: number };
const TOKEN = /"((?:[^"\\]|\\.)*)"|\{|\}|\/\/[^\n]*|[^\s{}"]+/g;

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(TOKEN)) {
    if (m[0].startsWith("//")) continue;
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

const unquote = (t: string) => (t.startsWith('"') ? t.slice(1, -1).replace(/\\(["\\])/g, "$1") : t);
const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function parseKeyValues(text: string): KVNode {
  const tokens = tokenize(text);
  let i = 0;
  const parseObject = (): KVNode => {
    const obj: KVNode = {};
    while (i < tokens.length) {
      const t = tokens[i++]!.text;
      if (t === "}") return obj;
      const next = tokens[i]?.text;
      if (next === "{") {
        i++;
        obj[unquote(t)] = parseObject();
      } else if (next !== undefined && next !== "}") {
        i++;
        obj[unquote(t)] = unquote(next);
      }
    }
    return obj;
  };
  return parseObject();
}

/** Offsets of the `{` and `}` tokens enclosing `path`; null when absent. */
function findSection(text: string, path: string[]): { open: number; close: number } | null {
  if (path.length === 0) return { open: -1, close: text.length };
  const tokens = tokenize(text);
  const stack: string[] = [];
  let open = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.text === "{") {
      stack.push(unquote(tokens[i - 1]?.text ?? ""));
      if (open < 0 && stack.length === path.length && path.every((p, k) => stack[k] === p))
        open = t.start;
    } else if (t.text === "}") {
      if (open >= 0 && stack.length === path.length) return { open, close: t.start };
      stack.pop();
    }
  }
  return null;
}

export function patchKeyValues(
  text: string,
  section: string[],
  updates: Record<string, string>,
): string {
  const range = findSection(text, section);
  if (!range) throw new Error(`Section "${section.join("/")}" not found`);
  let body = text.slice(range.open + 1, range.close);
  const indent = body.match(/\n([ \t]*)"/)?.[1] ?? "\t";
  for (const [key, value] of Object.entries(updates)) {
    const escaped = quote(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^([ \\t]*${escaped}[ \\t]+)"(?:[^"\\\\]|\\\\.)*"`, "m");
    if (re.test(body)) body = body.replace(re, (_m, lead: string) => `${lead}${quote(value)}`);
    else body = `${body.replace(/\s*$/, "")}\n${indent}${quote(key)}\t\t${quote(value)}\n`;
  }
  return text.slice(0, range.open + 1) + body + text.slice(range.close);
}
```

- [ ] **Step 5: Run** — `pnpm vitest run tests/keyvalues.test.ts` → PASS.
- [ ] **Step 6: Commit** — `git add lib/game-configs tests/keyvalues.test.ts tests/fixtures && git commit -m "feat(game-configs): Valve KeyValues parse and patch"`

### Task 6: INI codec

**Files:**

- Create: `lib/game-configs/formats/ini.ts`, `tests/fixtures/TASystemSettings.ini`, `tests/fixtures/TAInput.ini`
- Test: `tests/ini.test.ts`

**Interfaces:**

- Produces: `type IniDoc = Record<string, Record<string, string>>`; `parseIni(text): IniDoc` (first section occurrence and first key occurrence win); `patchIni(text, section: string, updates: Record<string,string>): string`.

- [ ] **Step 1: Fixtures** — `TASystemSettings.ini`: the first 20 lines of the real `[SystemSettings]` block plus `ResX`, `ResY`, `Borderless`, `Fullscreen`, `UseVsync` lines, then a second section `[SystemSettingsBucket1]` with `ResX=1280`, then `[IniVersion]` with `0=1`. Use CRLF line endings (the real file is CRLF — check with `file`). `TAInput.ini`: `[TAGame.PlayerInput_TA]` with `MouseSensitivity=10`, `GamepadDeadzone=0.3` and two `GamepadDeadzones=( … )` lines, then `[IniVersion]`.

- [ ] **Step 2: Failing test** — `tests/ini.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIni, patchIni } from "@/lib/game-configs/formats/ini";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

describe("ini", () => {
  it("reads the first section occurrence and keeps repeated keys' first value", () => {
    const doc = parseIni(fx("TASystemSettings.ini"));
    expect(doc.SystemSettings!.ResX).toBe("1920");
    expect(doc.SystemSettingsBucket1!.ResX).toBe("1280");
    const input = parseIni(fx("TAInput.ini"));
    expect(input["TAGame.PlayerInput_TA"]!.MouseSensitivity).toBe("10");
  });
  it("patches only the named section, keeps line endings, appends missing keys", () => {
    const src = fx("TASystemSettings.ini");
    const out = patchIni(src, "SystemSettings", { ResX: "2560", NewKey: "1" });
    expect(out).toContain("ResX=2560\r\n");
    expect(parseIni(out).SystemSettingsBucket1!.ResX).toBe("1280");
    expect(parseIni(out).SystemSettings!.NewKey).toBe("1");
    expect(out.replace("ResX=2560", "ResX=1920").replace("NewKey=1\r\n", "")).toBe(src);
  });
  it("throws when the section is missing", () => {
    expect(() => patchIni("[A]\nx=1\n", "B", { x: "2" })).toThrow(/Section/);
  });
});
```

- [ ] **Step 3: Run** — FAIL.

- [ ] **Step 4: Implement `lib/game-configs/formats/ini.ts`**

```ts
/** Unreal-style INI (Rocket League). Sections repeat; the first wins. Patching keeps line endings. */
export type IniDoc = Record<string, Record<string, string>>;

export function parseIni(text: string): IniDoc {
  const doc: IniDoc = {};
  let current = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      current = header[1]!;
      doc[current] ??= {};
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const section = (doc[current] ??= {});
    if (!(key in section)) section[key] = line.slice(eq + 1).trim();
  }
  return doc;
}

export function patchIni(text: string, section: string, updates: Record<string, string>): string {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `[${section}]`);
  if (start < 0) throw new Error(`Section [${section}] not found`);
  let end = lines.findIndex((l, i) => i > start && /^\s*\[.+\]\s*$/.test(l));
  if (end < 0) end = lines.length;
  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex(
      (l, i) => i > start && i < end && l.slice(0, l.indexOf("=")).trim() === key,
    );
    if (idx >= 0) {
      lines[idx] = `${key}=${value}`;
    } else {
      let at = end;
      while (at > start + 1 && lines[at - 1]!.trim() === "") at--;
      lines.splice(at, 0, `${key}=${value}`);
      end++;
    }
  }
  return lines.join(nl);
}
```

- [ ] **Step 5: Run** — PASS. **Step 6: Commit** — `git add lib/game-configs/formats/ini.ts tests/ini.test.ts tests/fixtures && git commit -m "feat(game-configs): INI parse and patch"`

### Task 7: Mapping — `readGameConfig` / `writeGameConfig`

**Files:**

- Create: `lib/game-configs/index.ts`
- Test: `tests/game-configs.test.ts`

**Interfaces:**

- Consumes: catalog types (Task 2), codecs (Tasks 5–6).
- Produces:
  - `type ConfigFiles = Partial<Record<string, string>>` (keyed by `CatalogFile.id`)
  - `readGameConfig(game: CatalogGame, files: ConfigFiles): { preset: PresetDoc; missingFiles: string[]; unmappedSettings: string[]; warnings: string[] }`
  - `writeGameConfig(game: CatalogGame, preset: PresetDoc, originals: ConfigFiles): { files: Record<string, string>; changed: Record<string, Record<string, string>>; skipped: string[] }`

- [ ] **Step 1: Failing test** — `tests/game-configs.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCatalogGame } from "@/lib/catalog";
import { readGameConfig, writeGameConfig } from "@/lib/game-configs";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");
const cs2 = getCatalogGame("cs2")!;
const rl = getCatalogGame("rocket-league")!;
const cs2Files = {
  video: fx("cs2_video.txt"),
  convars: fx("cs2_user_convars.vcfg"),
  keys: fx("cs2_user_keys.vcfg"),
};
type P = { categories: { name: string; settings: { name: string; value?: unknown }[] }[] };
const find = (p: P, cat: string, name: string) =>
  p.categories.find((c) => c.name === cat)!.settings.find((s) => s.name === name)!;

describe("readGameConfig", () => {
  it("reads CS2 video, convars and binds; defaults elsewhere", () => {
    const r = readGameConfig(cs2, cs2Files);
    expect(find(r.preset, "Video", "Resolution").value).toEqual({ width: 1280, height: 960 });
    expect(find(r.preset, "Video", "Display Mode").value).toBe("Fullscreen Windowed");
    expect(find(r.preset, "Video", "Multisampling Anti-Aliasing Mode").value).toBe("4x MSAA");
    expect(find(r.preset, "Video", "Wait for Vertical Sync").value).toBe(false);
    expect(find(r.preset, "Keyboard / Mouse", "Mouse Sensitivity").value).toBeTypeOf("number");
    expect(find(r.preset, "Crosshair", "Outline").value).toBe(true);
    expect(find(r.preset, "Keybinds", "Toggle Console").value).toBe("p");
    expect(find(r.preset, "Keybinds", "Fire").value).toBe("mouse1"); // default, not in file
    expect(r.missingFiles).toEqual([]);
    expect(r.unmappedSettings).toContain("Video › Brightness");
  });
  it("reports missing files and keeps defaults", () => {
    const r = readGameConfig(cs2, { video: cs2Files.video });
    expect(r.missingFiles).toEqual(["convars", "keys"]);
    expect(find(r.preset, "Crosshair", "Length").value).toBe(5);
  });
  it("warns on values it cannot decode", () => {
    const broken = cs2Files.video.replace(
      '"setting.mat_vsync"\t\t"0"',
      '"setting.mat_vsync"\t\t"maybe"',
    );
    const r = readGameConfig(cs2, { video: broken });
    expect(r.warnings.some((w) => w.includes("mat_vsync"))).toBe(true);
    expect(find(r.preset, "Video", "Wait for Vertical Sync").value).toBe(false);
  });
  it("reads Rocket League video + input and lists camera as unmapped", () => {
    const r = readGameConfig(rl, { video: fx("TASystemSettings.ini"), input: fx("TAInput.ini") });
    expect(find(r.preset, "Video", "Resolution").value).toEqual({ width: 1920, height: 1080 });
    expect(find(r.preset, "Video", "Display Mode").value).toBe("Fullscreen");
    expect(find(r.preset, "Video", "Motion Blur").value).toBe(false);
    expect(find(r.preset, "Controls", "Mouse Sensitivity").value).toBe(10);
    expect(r.unmappedSettings).toContain("Camera › Field of View");
  });
});

describe("writeGameConfig", () => {
  it("round-trips: read → write → read is stable", () => {
    const first = readGameConfig(cs2, cs2Files);
    const w = writeGameConfig(cs2, first.preset, cs2Files);
    const second = readGameConfig(cs2, { ...cs2Files, ...w.files });
    expect(second.preset).toEqual(first.preset);
  });
  it("writes changed values in the file's boolean style and unbinds the default key", () => {
    const r = readGameConfig(cs2, cs2Files);
    find(r.preset, "Video", "Wait for Vertical Sync").value = true;
    find(r.preset, "Crosshair", "Outline").value = false;
    find(r.preset, "Video", "Display Mode").value = "Windowed";
    find(r.preset, "Keybinds", "Jump").value = "mouse4";
    const w = writeGameConfig(cs2, r.preset, cs2Files);
    expect(w.files.video).toContain('"setting.mat_vsync"\t\t"1"');
    expect(w.files.video).toContain('"setting.nowindowborder"\t\t"0"');
    expect(w.files.convars).toContain('"cl_crosshair_drawoutline"\t\t"false"');
    expect(w.files.keys).toContain('"mouse4"\t\t"+jump"');
    expect(w.files.keys).toContain('"space"\t\t"<unbound>"');
  });
  it("skips settings whose file was not provided", () => {
    const r = readGameConfig(cs2, cs2Files);
    const w = writeGameConfig(cs2, r.preset, { video: cs2Files.video });
    expect(w.files.convars).toBeUndefined();
    expect(w.skipped.some((s) => s.startsWith("Crosshair"))).toBe(true);
  });
  it("patches Rocket League ini and keeps other sections", () => {
    const files = { video: fx("TASystemSettings.ini"), input: fx("TAInput.ini") };
    const r = readGameConfig(rl, files);
    find(r.preset, "Video", "Display Mode").value = "Borderless";
    const w = writeGameConfig(rl, r.preset, files);
    expect(w.files.video).toContain("Borderless=True");
    expect(w.files.video).toContain("Fullscreen=False");
    expect(w.files.video).toContain("[SystemSettingsBucket1]");
  });
});
```

- [ ] **Step 2: Run** — `pnpm vitest run tests/game-configs.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/game-configs/index.ts`**

```ts
/**
 * Turns a game's config files into a PresetDoc (the catalog is the map) and back.
 * Files are patched, never generated: `writeGameConfig` needs the originals.
 */
import type { CatalogFile, CatalogGame, CatalogSetting, SettingSource } from "@/lib/catalog";
import type { PresetDoc, SettingDoc } from "@/lib/import-export/schema";
import type { SettingValue } from "@/lib/settings/types";
import { parseKeyValues, patchKeyValues, type KVNode } from "./formats/keyvalues";
import { parseIni, patchIni } from "./formats/ini";

export type ConfigFiles = Partial<Record<string, string>>;
export type ReadResult = {
  preset: PresetDoc;
  missingFiles: string[];
  unmappedSettings: string[];
  warnings: string[];
};
export type WriteResult = {
  files: Record<string, string>;
  changed: Record<string, Record<string, string>>;
  skipped: string[];
};

/** Flat key → value for the file's declared section. */
function sectionValues(file: CatalogFile, text: string): Record<string, string> {
  if (file.format === "ini") return parseIni(text)[file.section[0] ?? ""] ?? {};
  let node: KVNode | string | undefined = parseKeyValues(text);
  for (const part of file.section) node = typeof node === "object" ? node[part] : undefined;
  const out: Record<string, string> = {};
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) if (typeof v === "string") out[k] = v;
  }
  return out;
}

const TRUE = new Set(["1", "true", "True", "TRUE"]);
const FALSE = new Set(["0", "false", "False", "FALSE"]);

function decode(setting: CatalogSetting, raw: string): SettingValue | undefined {
  switch (setting.type) {
    case "boolean":
      return TRUE.has(raw) ? true : FALSE.has(raw) ? false : undefined;
    case "integer":
    case "decimal":
    case "slider":
    case "percentage": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case "dropdown":
    case "enum":
      return setting.options?.some((o) => o.value === raw) ? raw : undefined;
    default:
      return raw;
  }
}

function encode(file: CatalogFile, value: SettingValue): string {
  if (typeof value === "boolean") {
    if (file.bool === "01") return value ? "1" : "0";
    if (file.bool === "truefalse") return value ? "true" : "false";
    return value ? "True" : "False";
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "object") return `${value.width}x${value.height}`;
  return value;
}

function readOne(
  s: CatalogSetting,
  source: SettingSource,
  vals: Record<string, string>,
  warnings: string[],
  label: string,
): SettingValue | undefined {
  if ("key" in source) {
    const raw = vals[source.key];
    if (raw === undefined) return undefined;
    const v = decode(s, raw);
    if (v === undefined) warnings.push(`${label}: unexpected value "${raw}" for ${source.key}`);
    return v;
  }
  if ("width" in source) {
    const w = Number(vals[source.width]);
    const h = Number(vals[source.height]);
    return w > 0 && h > 0 ? { width: w, height: h } : undefined;
  }
  if ("match" in source) {
    const hit = source.match.find((m) => Object.entries(m.keys).every(([k, v]) => vals[k] === v));
    const present = Object.keys(source.match[0]!.keys).some((k) => k in vals);
    if (!hit && present) warnings.push(`${label}: the file's values match none of the options`);
    return hit?.value;
  }
  // ponytail: a key rebound *away* from its command still reads as the default binding.
  return Object.entries(vals).find(([, cmd]) => cmd === source.bind)?.[0];
}

export function readGameConfig(game: CatalogGame, files: ConfigFiles): ReadResult {
  const template = game.presets[0]!;
  const warnings: string[] = [];
  const unmappedSettings: string[] = [];
  const missingFiles = game.files.filter((f) => files[f.id] == null).map((f) => f.id);
  const parsed = new Map<string, Record<string, string>>();
  for (const f of game.files) {
    const text = files[f.id];
    if (text == null) continue;
    try {
      parsed.set(f.id, sectionValues(f, text));
    } catch (e) {
      warnings.push(`${f.id}: could not parse (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  const categories = template.categories.map((c) => ({
    ...c,
    settings: c.settings.map((cs) => {
      const { source, ...s } = cs;
      const label = `${c.name} › ${s.name}`;
      if (!source) {
        unmappedSettings.push(label);
        return s;
      }
      const vals = parsed.get(source.file);
      if (!vals) return s;
      const v = readOne(cs, source, vals, warnings, label);
      return v === undefined ? s : { ...s, value: v };
    }),
  }));
  return { preset: { ...template, categories }, missingFiles, unmappedSettings, warnings };
}

export function writeGameConfig(
  game: CatalogGame,
  preset: PresetDoc,
  originals: ConfigFiles,
): WriteResult {
  const updates = new Map<string, Record<string, string>>();
  const skipped: string[] = [];
  const bySetting = new Map<string, SettingDoc>();
  for (const c of preset.categories)
    for (const s of c.settings) bySetting.set(`${c.name}/${s.name}`, s);

  for (const c of game.presets[0]!.categories) {
    for (const cs of c.settings) {
      const src = cs.source;
      if (!src) continue;
      const label = `${c.name} › ${cs.name}`;
      const file = game.files.find((f) => f.id === src.file)!;
      const original = originals[file.id];
      if (original == null) {
        skipped.push(`${label}: no ${file.id} file provided`);
        continue;
      }
      const s = bySetting.get(`${c.name}/${cs.name}`);
      if (!s || s.value == null) {
        skipped.push(`${label}: not in this preset`);
        continue;
      }
      let u = updates.get(file.id);
      if (!u) updates.set(file.id, (u = {}));
      if ("key" in src) {
        u[src.key] = encode(file, s.value);
      } else if ("width" in src) {
        if (typeof s.value === "object" && !Array.isArray(s.value)) {
          u[src.width] = String(s.value.width);
          u[src.height] = String(s.value.height);
        }
      } else if ("match" in src) {
        const m = src.match.find((o) => o.value === s.value);
        if (m) Object.assign(u, m.keys);
        else skipped.push(`${label}: "${String(s.value)}" has no file mapping`);
      } else {
        const key = String(s.value);
        const def = cs.defaultValue != null ? String(cs.defaultValue) : null;
        const current = sectionValues(file, original);
        if (key === def && current[key] === undefined) continue; // default and not overridden
        u[key] = src.bind;
        // ponytail: two settings moved onto the same key → last one wins, as in the game.
        if (def && def !== key && (current[def] === undefined || current[def] === src.bind)) {
          u[def] = "<unbound>";
        }
      }
    }
  }

  const files: Record<string, string> = {};
  for (const [id, u] of updates) {
    const f = game.files.find((x) => x.id === id)!;
    const text = originals[id]!;
    files[id] =
      f.format === "ini"
        ? patchIni(text, f.section[0] ?? "", u)
        : patchKeyValues(text, f.section, u);
  }
  return { files, changed: Object.fromEntries(updates), skipped };
}
```

- [ ] **Step 4: Run** — PASS. If a test exposes a wrong key or label, fix the catalog data (Task 3): the fixture is the truth.
- [ ] **Step 5: Commit** — `git add lib/game-configs/index.ts tests/game-configs.test.ts && git commit -m "feat(game-configs): read and write presets through the catalog mapping"`

### Task 8: Server glue, web import tab, config-files dialog

**Files:**

- Modify: `lib/data/catalog.ts` (add `importConfigFiles`, `patchConfigFiles`), `lib/data/import.ts` (`createdPresetSlugs`), `lib/actions/catalog.ts` (three actions), `lib/validation/index.ts` (two schemas)
- Create: `components/import-export/game-files-form.tsx`, `components/presets/config-files-dialog.tsx`
- Modify: `app/(app)/import/page.tsx` (tabs), `components/presets/preset-actions.tsx` + `preset-header.tsx` (menu item + prop), `app/(app)/games/[gameSlug]/[presetSlug]/page.tsx` (pass `catalogEntry`)

**Interfaces:**

- Produces (data):
  - `importConfigFiles(userId, { catalogId; files: ConfigFiles; name?; device? }): Promise<{ gameSlug; presetSlug; read: ReadResult }>`
  - `patchConfigFiles(userId, { catalogId; presetId?; presetSlug?; files }): Promise<WriteResult>`
- Produces (actions): `previewGameConfigAction({ catalogId, files })` → `{ missingFiles; unmappedSettings; warnings; settingCount }`; `importGameConfigAction({ catalogId, files, name? })` → `{ url; read }`; `patchGameConfigAction({ catalogId, presetId, files })` → `WriteResult`.
- Produces (validation): `configFilesSchema = z.record(z.string().max(40), z.string().max(512 * 1024, "Each file must be 512 KB or smaller."))`, `catalogIdSchema = z.string().regex(/^[a-z0-9-]+$/)`.

- [ ] **Step 1: `ImportOutcome.createdPresetSlugs`** — in `lib/data/import.ts` add `createdPresetSlugs: string[]` to the type, initialise `[]` in `importFile`, and `outcome.createdPresetSlugs.push(slug)` after each preset insert in `importPresetsInto`. Run `pnpm check`.

- [ ] **Step 2: Data functions** (append to `lib/data/catalog.ts`)

```ts
import { readGameConfig, writeGameConfig, type ConfigFiles } from "@/lib/game-configs";
import { getPresetBySlug, getPresetFull, toPresetDoc } from "@/lib/data/presets";

export async function importConfigFiles(
  userId: string,
  input: { catalogId: string; files: ConfigFiles; name?: string | null; device?: string | null },
) {
  const entry = getCatalogGame(input.catalogId);
  if (!entry) throw new AppError("That game isn't in the catalog.");
  if (Object.keys(input.files).length === 0) throw new AppError("No config files were provided.");
  const read = readGameConfig(entry, input.files);
  const game =
    (await findGameByCatalogId(userId, input.catalogId)) ??
    (await createGameFromCatalog(userId, input.catalogId));
  const stamp = new Date().toISOString().slice(0, 10);
  const from = input.device ? ` from ${input.device}` : "";
  const name = input.name?.trim() || `Imported${from} ${stamp}`;
  const doc = catalogToGameDoc(entry);
  const outcome = await importFile(
    userId,
    {
      format: "gamesettings-vault",
      version: 1,
      kind: "preset",
      games: [{ ...doc, presets: [{ ...read.preset, name, isDefault: false }] }],
    },
    { targetGameId: game.id },
  );
  return { gameSlug: game.slug, presetSlug: outcome.createdPresetSlugs[0]!, read };
}

export async function patchConfigFiles(
  userId: string,
  input: { catalogId: string; presetId?: string; presetSlug?: string; files: ConfigFiles },
) {
  const entry = getCatalogGame(input.catalogId);
  if (!entry) throw new AppError("That game isn't in the catalog.");
  let presetId = input.presetId;
  if (!presetId) {
    const game = await findGameByCatalogId(userId, input.catalogId);
    if (!game)
      throw new AppError(`You don't have ${entry.name} in your library yet. Run import first.`);
    const row = await getPresetBySlug(userId, game.id, input.presetSlug ?? "");
    if (!row) throw new AppError(`No preset "${input.presetSlug}" in ${game.name}.`);
    presetId = row.id;
  }
  const preset = toPresetDoc(await getPresetFull(userId, presetId));
  return writeGameConfig(entry, preset, input.files);
}
```

- [ ] **Step 3: Actions** (append to `lib/actions/catalog.ts`)

```ts
import { importConfigFiles, patchConfigFiles } from "@/lib/data/catalog";
import { readGameConfig } from "@/lib/game-configs";
import { getCatalogGame } from "@/lib/catalog";
import { catalogIdSchema, configFilesSchema, id } from "@/lib/validation";
import { AppError } from "@/lib/data/errors";

const filesInput = z.object({ catalogId: catalogIdSchema, files: configFilesSchema });

export async function previewGameConfigAction(raw: unknown) {
  return runAction(filesInput, raw, async (v) => {
    const entry = getCatalogGame(v.catalogId);
    if (!entry) throw new AppError("That game isn't in the catalog.");
    const { preset, ...rest } = readGameConfig(entry, v.files);
    return { ...rest, settingCount: preset.categories.reduce((n, c) => n + c.settings.length, 0) };
  });
}

export async function importGameConfigAction(raw: unknown) {
  const schema = filesInput.extend({ name: z.string().trim().max(80).optional() });
  return runAction(schema, raw, async (v, userId) => {
    const r = await importConfigFiles(userId, v);
    revalidatePath("/", "layout");
    const { preset: _preset, ...read } = r.read;
    return { url: `/games/${r.gameSlug}/${r.presetSlug}`, read };
  });
}

export async function patchGameConfigAction(raw: unknown) {
  return runAction(filesInput.extend({ presetId: id }), raw, (v, userId) =>
    patchConfigFiles(userId, v),
  );
}
```

- [ ] **Step 4: `components/import-export/game-files-form.tsx`**

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importGameConfigAction, previewGameConfigAction } from "@/lib/actions/catalog";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { plural } from "@/lib/utils/format";

type Preview = {
  missingFiles: string[];
  unmappedSettings: string[];
  warnings: string[];
  settingCount: number;
};
const MAX = 512 * 1024;

/** Pick a catalog game, choose its config files, preview what will be read, import as a new preset. */
export function GameFilesForm({ catalog }: { catalog: PublicCatalogEntry[] }) {
  const router = useRouter();
  const withFiles = catalog.filter((c) => c.files.length > 0);
  const [gameId, setGameId] = React.useState(withFiles[0]?.id ?? "");
  const [files, setFiles] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [pending, startTransition] = React.useTransition();
  const game = withFiles.find((c) => c.id === gameId);

  React.useEffect(() => {
    if (!game || Object.keys(files).length === 0) return setPreview(null);
    let cancelled = false;
    void previewGameConfigAction({ catalogId: game.id, files }).then((r) => {
      if (cancelled) return;
      if (!r.ok) return toast.error(r.error);
      setPreview(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [game, files]);

  const changeGame = (id: string) => {
    setGameId(id);
    setFiles({});
    setPreview(null);
  };

  const onFile = (fileId: string, f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX) return toast.error("That file is larger than 512 KB — is it the right one?");
    void f.text().then((text) => setFiles((prev) => ({ ...prev, [fileId]: text })));
  };

  const submit = () =>
    startTransition(async () => {
      if (!game) return;
      const r = await importGameConfigAction({
        catalogId: game.id,
        files,
        name: name || undefined,
      });
      if (!r.ok) return toast.error(r.error);
      toast.success("Preset imported from your game files");
      router.push(r.data.url);
    });

  if (!game) return <p className="text-[13px] text-ink-2">No catalog game has file support yet.</p>;
  const hintFor = (f: PublicCatalogEntry["files"][number]) =>
    f.paths["steam-windows"] ?? f.paths["epic-windows"] ?? Object.values(f.paths)[0];
  return (
    <div className="flex flex-col gap-5">
      <Field label="Game" htmlFor="gf-game">
        <Select value={gameId} onValueChange={changeGame}>
          <SelectTrigger id="gf-game">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {withFiles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {game.files.map((f) => (
        <Field key={f.id} label={`${f.id} file`} htmlFor={`gf-${f.id}`} hint={hintFor(f)}>
          <Input
            id={`gf-${f.id}`}
            type="file"
            onChange={(e) => onFile(f.id, e.target.files?.[0])}
          />
        </Field>
      ))}
      {preview ? (
        <div className="rounded-sm border border-line p-3 text-[13px] text-ink-2" role="status">
          <p className="text-ink">{plural(preview.settingCount, "setting")} will be created.</p>
          {preview.missingFiles.length > 0 ? (
            <p>
              Not provided: {preview.missingFiles.join(", ")} — those settings keep their defaults.
            </p>
          ) : null}
          {preview.unmappedSettings.length > 0 ? (
            <p>
              {plural(preview.unmappedSettings.length, "setting")} aren’t stored in files (e.g.{" "}
              {preview.unmappedSettings[0]}); enter them by hand.
            </p>
          ) : null}
          {preview.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}
      <Field label="Preset name" htmlFor="gf-name" optional hint="Defaults to “Imported <date>”.">
        <Input id="gf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <Button
        variant="primary"
        onClick={submit}
        loading={pending}
        disabled={Object.keys(files).length === 0}
      >
        Import as preset
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Import page tabs** — read `components/ui/tabs.tsx` for its API, then in `app/(app)/import/page.tsx` render two tabs: "Vault JSON" → existing `<ImportForm …/>`, "Game files" → `<GameFilesForm catalog={publicCatalog()} />`. Default tab from `?tab=files`.

- [ ] **Step 6: `components/presets/config-files-dialog.tsx`**

```tsx
"use client";
import * as React from "react";
import { toast } from "sonner";
import { patchGameConfigAction } from "@/lib/actions/catalog";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetId: string;
  entry: PublicCatalogEntry;
};
type Result = { files: Record<string, string>; skipped: string[] };

/** Upload the game's current files, get them back patched with this preset's values. */
export function ConfigFilesDialog({ open, onOpenChange, presetId, entry }: Props) {
  const [files, setFiles] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<Result | null>(null);
  const [pending, startTransition] = React.useTransition();
  const fileName = (id: string) =>
    (Object.values(entry.files.find((f) => f.id === id)?.paths ?? {})[0] ?? id)
      .split(/[\\/]/)
      .pop()!;

  const run = () =>
    startTransition(async () => {
      const r = await patchGameConfigAction({ catalogId: entry.id, presetId, files });
      if (!r.ok) return toast.error(r.error);
      setResult(r.data);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Game config files"
        description="Upload the files the game has now and get them back with this preset’s values. Replace the originals while the game is closed — or let the companion do it: gsv apply."
      >
        <div className="flex flex-col gap-4">
          {entry.files.map((f) => (
            <Field
              key={f.id}
              label={fileName(f.id)}
              htmlFor={`cf-${f.id}`}
              hint={Object.values(f.paths)[0]}
            >
              <Input
                id={`cf-${f.id}`}
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void file.text().then((t) => setFiles((p) => ({ ...p, [f.id]: t })));
                }}
              />
            </Field>
          ))}
          {result ? (
            <ul className="flex flex-col gap-2 text-[13px]">
              {Object.entries(result.files).map(([id, text]) => (
                <li key={id}>
                  <a
                    download={fileName(id)}
                    href={URL.createObjectURL(new Blob([text], { type: "text/plain" }))}
                    className="text-ink underline underline-offset-4"
                  >
                    Download {fileName(id)}
                  </a>
                </li>
              ))}
              {result.skipped.map((s) => (
                <li key={s} className="text-ink-3">
                  Skipped — {s}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={run}
            loading={pending}
            disabled={Object.keys(files).length === 0}
          >
            Patch files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: Menu item** — `PresetActionsMenu` gets `catalogEntry?: PublicCatalogEntry | null`. When `catalogEntry?.files.length`, add next to the Export submenu:

```tsx
<DropdownMenuItem onSelect={() => setConfigFiles(true)}>
  <FileCog className="size-4" /> Game config files…
</DropdownMenuItem>
```

and render `<ConfigFilesDialog open={configFiles} onOpenChange={setConfigFiles} presetId={preset.id} entry={catalogEntry} />`. Thread the prop through `PresetHeader`; the preset page computes `catalogEntry = game.catalogId ? (publicCatalog().find((c) => c.id === game.catalogId) ?? null) : null`.

- [ ] **Step 8: Verify** — `pnpm check` PASS. Manual: `/import?tab=files` → upload the real `cs2_video.txt` → preview shows counts → import lands on the new preset with Resolution 1280×960. On that preset: "Game config files…" → upload the same file → downloaded file has the same `setting.defaultres`.
- [ ] **Step 9: Commit** — `git add -A && git commit -m "feat: import game config files as presets; patch and download config files"`

## Phase 3 — Search and installed games

### Task 9: Steam store search + device games + name suggestions

**Files:**

- Create: `lib/providers/steam-store.ts`, `lib/data/devices.ts`, `lib/actions/search-games.ts`, `components/games/game-name-suggest.tsx`
- Modify: `components/games/game-dialog.tsx` (Name field), `lib/validation/index.ts` (`catalogId` on `gameInputSchema`)
- Test: `tests/steam-store.test.ts`

**Interfaces:**

- `searchSteamStore(q: string, fetchImpl = fetch): Promise<{ appId: number; name: string; coverUrl: string }[]>` — never throws; `[]` on any failure or when `q.length < 2`.
- `replaceDeviceGames(userId, device: string, games: { source: "steam" | "epic"; appId: string; name: string; installDir?: string | null }[]): Promise<number>`; `listDeviceGames(userId, q?: string): Promise<DeviceGame[]>`; `listDevices(userId): Promise<{ device: string; games: number; seenAt: Date }[]>`.
- `searchGamesAction(q: string)` → `{ installed: { device; source; appId; name; catalogId: string | null }[]; steam: { appId; name; coverUrl; catalogId: string | null }[] }`.
- `gameInputSchema` gains `catalogId: catalogIdSchema.nullish()`; `createGame` already spreads `input`, so the column is written for free.

- [ ] **Step 1: Failing test** — `tests/steam-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { searchSteamStore } from "@/lib/providers/steam-store";

const ok = (body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("searchSteamStore", () => {
  it("maps store results to name, app id and header image", async () => {
    const r = await searchSteamStore(
      "counter",
      ok({ items: [{ id: 730, name: "Counter-Strike 2" }] }),
    );
    expect(r).toEqual([
      {
        appId: 730,
        name: "Counter-Strike 2",
        coverUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
      },
    ]);
  });
  it("returns [] for short queries and on errors", async () => {
    expect(await searchSteamStore("c", ok({ items: [] }))).toEqual([]);
    const boom = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await searchSteamStore("counter", boom)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: `lib/providers/steam-store.ts`**

```ts
/**
 * Public Steam store search — no API key, no account. Used only to suggest names and covers.
 * Covers are hot-linked from Steam's CDN (https), never copied into the repo.
 */
export type SteamHit = { appId: number; name: string; coverUrl: string };

export const steamCoverUrl = (appId: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;

export async function searchSteamStore(
  q: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SteamHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    const url = `https://store.steampowered.com/api/storesearch/?cc=us&l=en&term=${encodeURIComponent(term)}`;
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: { id: number; name: string }[] };
    return (json.items ?? [])
      .slice(0, 8)
      .map((i) => ({ appId: i.id, name: i.name, coverUrl: steamCoverUrl(i.id) }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: `lib/data/devices.ts`**

```ts
import "server-only";
import { and, desc, eq, ilike, max, count } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { deviceGames } = schema;
export type DeviceGameInput = {
  source: "steam" | "epic";
  appId: string;
  name: string;
  installDir?: string | null;
};

/** A scan is the whole truth for that device: replace its rows. */
export async function replaceDeviceGames(userId: string, device: string, games: DeviceGameInput[]) {
  return db.transaction(async (tx) => {
    await tx
      .delete(deviceGames)
      .where(and(eq(deviceGames.userId, userId), eq(deviceGames.device, device)));
    if (games.length === 0) return 0;
    await tx
      .insert(deviceGames)
      .values(games.map((g) => ({ ...g, userId, device, installDir: g.installDir ?? null })));
    return games.length;
  });
}

export async function listDeviceGames(userId: string, q?: string) {
  const where = q?.trim()
    ? and(
        eq(deviceGames.userId, userId),
        ilike(deviceGames.name, `%${q.trim().replace(/[%_]/g, "\\$&")}%`),
      )
    : eq(deviceGames.userId, userId);
  return db.select().from(deviceGames).where(where).orderBy(deviceGames.name).limit(20);
}

export async function listDevices(userId: string) {
  return db
    .select({ device: deviceGames.device, games: count(), seenAt: max(deviceGames.seenAt) })
    .from(deviceGames)
    .where(eq(deviceGames.userId, userId))
    .groupBy(deviceGames.device)
    .orderBy(desc(max(deviceGames.seenAt)));
}
```

- [ ] **Step 5: `lib/actions/search-games.ts`**

```ts
"use server";
import { z } from "zod";
import { CATALOG } from "@/lib/catalog";
import { listDeviceGames } from "@/lib/data/devices";
import { searchSteamStore } from "@/lib/providers/steam-store";
import { runAction } from "./shared";

const catalogIdFor = (source: "steam" | "epic", appId: string) =>
  CATALOG.find((g) =>
    source === "steam" ? String(g.steamAppId) === appId : g.epicAppName === appId,
  )?.id ?? null;

export async function searchGamesAction(q: string) {
  return runAction(z.object({ q: z.string().max(80) }), { q }, async (v, userId) => {
    const [installed, steam] = await Promise.all([
      listDeviceGames(userId, v.q),
      searchSteamStore(v.q),
    ]);
    return {
      installed: installed.map((g) => ({
        device: g.device,
        source: g.source,
        appId: g.appId,
        name: g.name,
        catalogId: catalogIdFor(g.source, g.appId),
      })),
      steam: steam.map((s) => ({ ...s, catalogId: catalogIdFor("steam", String(s.appId)) })),
    };
  });
}
```

- [ ] **Step 6: `components/games/game-name-suggest.tsx`**

```tsx
"use client";
import * as React from "react";
import { MonitorSmartphone, Search } from "lucide-react";
import { searchGamesAction } from "@/lib/actions/search-games";
import { Input } from "@/components/ui/input";

export type Suggestion = {
  name: string;
  coverUrl?: string | null;
  catalogId: string | null;
  device?: string;
};
type Results =
  Awaited<ReturnType<typeof searchGamesAction>> extends { ok: true; data: infer D } ? D : never;

/** Name input with a listbox of installed-on-device and Steam store matches. Plain typing still works. */
export function GameNameSuggest({
  id,
  value,
  onChange,
  onPick,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
}) {
  const [results, setResults] = React.useState<Results | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (value.trim().length < 2) return setResults(null);
    const t = setTimeout(() => {
      void searchGamesAction(value).then((r) => {
        if (r.ok) setResults(r.data);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  const rows: Suggestion[] = [
    ...(results?.installed.map((g) => ({
      name: g.name,
      catalogId: g.catalogId,
      device: g.device,
    })) ?? []),
    ...(results?.steam.map((s) => ({
      name: s.name,
      coverUrl: s.coverUrl,
      catalogId: s.catalogId,
    })) ?? []),
  ];
  const listId = `${id}-suggestions`;
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        role="combobox"
        aria-expanded={open && rows.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="e.g. Skyline Drift"
        required
        maxLength={120}
      />
      {open && rows.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="bg-panel absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-sm border border-line p-1 shadow-lg"
        >
          {rows.map((s, i) => (
            <li key={`${s.device ?? "steam"}-${s.name}-${i}`} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
                className="menu-row flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-[13px]"
              >
                {s.device ? (
                  <MonitorSmartphone className="size-3.5 text-ink-3" aria-hidden />
                ) : (
                  <Search className="size-3.5 text-ink-3" aria-hidden />
                )}
                <span className="text-ink">{s.name}</span>
                <span className="ml-auto text-xs text-ink-3">
                  {s.device ? `Installed on ${s.device}` : "Steam"}
                  {s.catalogId ? " · catalog" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

Check `bg-panel` exists in `globals.css` (the dialog/menu background token); use whatever token `dropdown-menu.tsx` uses.

- [ ] **Step 7: Wire into `GameForm`** — replace the Name `<Input>` with `<GameNameSuggest id="game-name" value={name} onChange={setName} onPick={pick} />` where

```ts
const [catalogId, setCatalogId] = React.useState<string | null>(game?.catalogId ?? null);
const pick = (s: Suggestion) => {
  setName(s.name);
  if (s.coverUrl && !coverUrl) setCoverUrl(s.coverUrl);
  if (!platforms.includes("PC")) setPlatforms([...platforms, "PC"]);
  setCatalogId(s.catalogId);
};
```

and add `catalogId` to the submitted `input`. When `catalogId` is set and the user submits the plain form, the game is created empty but linked (the "From the catalog" list is the way to get the full menu; add a hint under the name: _"Counter-Strike 2 is in the catalog — pick it above to get its full settings menu."_ when `catalogId` is set).

- [ ] **Step 8: Verify** — `pnpm vitest run tests/steam-store.test.ts` PASS; `pnpm check` PASS; manual: type "rocket" in Add game → Steam suggestion with cover appears.
- [ ] **Step 9: Commit** — `git add -A && git commit -m "feat: game name suggestions from installed games and the Steam store"`

## Phase 4 — Companion

### Task 10: Tokens — data, auth helper, Settings card

**Files:**

- Create: `lib/data/companion-tokens.ts`, `lib/auth/companion.ts`, `lib/actions/companion.ts`, `components/settings-page/companion-card.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Test: `tests/companion-tokens.test.ts`

**Interfaces:**

- `generateToken(): { token: string; hash: string }` (pure; `token = "gsv_" + base64url(32 random bytes)`, `hash = sha256 hex`); `hashToken(token): string`.
- `createCompanionToken(userId, name): Promise<{ id; name; token }>`; `listCompanionTokens(userId): Promise<Pick<CompanionToken,"id"|"name"|"createdAt"|"lastUsedAt">[]>`; `revokeCompanionToken(userId, id)`; `userIdForToken(token): Promise<string | null>` (updates `last_used_at`).
- `requireCompanionUser(req: Request): Promise<string>` — throws `UnauthorizedError` (from `lib/auth/session.ts`) when the header is missing/invalid.
- Actions: `createCompanionTokenAction(name)` → `{ token }`; `revokeCompanionTokenAction(id)`.

- [ ] **Step 1: Failing test** — `tests/companion-tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "@/lib/auth/companion-token";

describe("companion tokens", () => {
  it("generates gsv_ tokens with a stable sha256", () => {
    const { token, hash } = generateToken();
    expect(token).toMatch(/^gsv_[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generateToken().token).not.toBe(token);
  });
});
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: `lib/auth/companion-token.ts`** (pure, importable by tests and by `lib/data`)

```ts
import { createHash, randomBytes } from "node:crypto";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = `gsv_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token) };
}
```

- [ ] **Step 4: `lib/data/companion-tokens.ts`**

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth/companion-token";

const { companionTokens } = schema;

export async function createCompanionToken(userId: string, name: string) {
  const { token, hash } = generateToken();
  const [row] = await db
    .insert(companionTokens)
    .values({ userId, name, tokenHash: hash })
    .returning({ id: companionTokens.id });
  return { id: row!.id, name, token };
}

export function listCompanionTokens(userId: string) {
  return db.query.companionTokens.findMany({
    where: eq(companionTokens.userId, userId),
    columns: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: (t, { desc }) => desc(t.createdAt),
  });
}

export async function revokeCompanionToken(userId: string, id: string) {
  await db
    .delete(companionTokens)
    .where(and(eq(companionTokens.userId, userId), eq(companionTokens.id, id)));
}

/** Resolves a bearer token to its user and stamps last_used_at; null when unknown. */
export async function userIdForToken(token: string) {
  if (!token.startsWith("gsv_")) return null;
  const [row] = await db
    .update(companionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(companionTokens.tokenHash, hashToken(token)))
    .returning({ userId: companionTokens.userId });
  return row?.userId ?? null;
}
```

- [ ] **Step 5: `lib/auth/companion.ts`**

```ts
import "server-only";
import { UnauthorizedError } from "@/lib/auth/session";
import { userIdForToken } from "@/lib/data/companion-tokens";

/** `Authorization: Bearer gsv_…` → user id. Fails closed. */
export async function requireCompanionUser(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const userId = token ? await userIdForToken(token) : null;
  if (!userId)
    throw new UnauthorizedError("Invalid or revoked companion token. Run `gsv login` again.");
  return userId;
}
```

Check `UnauthorizedError`'s constructor in `lib/auth/session.ts:28` accepts a message; if not, add `constructor(message = "Sign in to continue.") { super(message); }`.

- [ ] **Step 6: Actions** — `lib/actions/companion.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCompanionToken, revokeCompanionToken } from "@/lib/data/companion-tokens";
import { id } from "@/lib/validation";
import { runAction } from "./shared";

export async function createCompanionTokenAction(name: string) {
  return runAction(
    z.object({ name: z.string().trim().min(1, "Give the token a name.").max(60) }),
    { name },
    async (v, userId) => {
      const t = await createCompanionToken(userId, v.name);
      revalidatePath("/settings");
      return { token: t.token };
    },
  );
}

export async function revokeCompanionTokenAction(tokenId: string) {
  return runAction(z.object({ tokenId: id }), { tokenId }, async (v, userId) => {
    await revokeCompanionToken(userId, v.tokenId);
    revalidatePath("/settings");
    return null;
  });
}
```

- [ ] **Step 7: `components/settings-page/companion-card.tsx`**

```tsx
"use client";
import * as React from "react";
import { toast } from "sonner";
import { createCompanionTokenAction, revokeCompanionTokenAction } from "@/lib/actions/companion";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { useCopy } from "@/lib/copy/use-copy";
import { formatRelative } from "@/lib/utils/format";

type Token = { id: string; name: string; createdAt: Date; lastUsedAt: Date | null };
type Device = { device: string; games: number; seenAt: Date | null };

export function CompanionCard({
  tokens,
  devices,
  appUrl,
}: {
  tokens: Token[];
  devices: Device[];
  appUrl: string;
}) {
  const [name, setName] = React.useState("");
  const [fresh, setFresh] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<Token | null>(null);
  const [pending, start] = React.useTransition();
  const copy = useCopy();

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createCompanionTokenAction(name);
      if (!r.ok) return toast.error(r.error);
      setFresh(r.data.token);
      setName("");
    });
  };

  return (
    <div className="flex flex-col gap-6 text-[13px]">
      <div className="rounded-sm border border-line p-3">
        <p className="text-ink">Install the companion on your gaming PC:</p>
        <pre className="bg-bg-2 mt-2 overflow-x-auto rounded-xs p-2 text-xs">{`git clone <repo> && cd gamesettings-vault/companion && npm i -g .\ngsv login ${appUrl}\ngsv scan --push\ngsv import cs2`}</pre>
        <p className="mt-2 text-ink-3">
          It reads your game config files and never runs while a game is open. Docs:
          docs/companion.md
        </p>
      </div>

      <form onSubmit={create} className="flex items-end gap-2">
        <Field label="New token" htmlFor="tok-name" className="flex-1">
          <Input
            id="tok-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gaming PC"
            maxLength={60}
            required
          />
        </Field>
        <Button type="submit" variant="primary" loading={pending}>
          Create token
        </Button>
      </form>
      {fresh ? (
        <div role="alert" className="rounded-sm border border-line-strong p-3">
          <p className="text-ink">Copy it now — it won’t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="bg-bg-2 flex-1 overflow-x-auto rounded-xs p-2 text-xs">{fresh}</code>
            <Button size="sm" onClick={() => copy(fresh, "Token copied")}>
              Copy
            </Button>
          </div>
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <ul className="divide-y divide-line">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <span className="text-ink">{t.name}</span>
              <span className="text-ink-3">
                created {formatRelative(t.createdAt)}
                {t.lastUsedAt ? ` · used ${formatRelative(t.lastUsedAt)}` : " · never used"}
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRevoking(t)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {devices.length > 0 ? (
        <div>
          <p className="font-medium text-ink">Devices</p>
          <ul className="mt-1 text-ink-2">
            {devices.map((d) => (
              <li key={d.device}>
                {d.device} — {d.games} games, scanned{" "}
                {d.seenAt ? formatRelative(d.seenAt) : "never"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        open={revoking != null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke “${revoking?.name}”?`}
        description="The companion using it will stop working until you log in with a new token."
        confirmLabel="Revoke"
        destructive
        onConfirm={() =>
          start(async () => {
            const r = await revokeCompanionTokenAction(revoking!.id);
            setRevoking(null);
            if (!r.ok) return toast.error(r.error);
            toast.success("Token revoked");
          })
        }
      />
    </div>
  );
}
```

Match `ConfirmDialog`'s real prop names (read `components/ui/alert-dialog.tsx`) and `useCopy`'s signature (`lib/copy/use-copy.ts`); `formatRelative` lives in `lib/utils/format.ts` — use the existing relative-time helper name there.

- [ ] **Step 8: Settings page** — add a `<Section id="companion" title="Companion">` after Preferences, rendering `<CompanionCard tokens={await listCompanionTokens(user.id)} devices={await listDevices(user.id)} appUrl={env.BETTER_AUTH_URL} />`.

- [ ] **Step 9: Verify** — tests PASS, `pnpm check` PASS; manual: create a token in Settings, see it listed, revoke it.
- [ ] **Step 10: Commit** — `git add -A && git commit -m "feat(companion): personal access tokens and devices in Settings"`

### Task 11: Companion API routes

**Files:**

- Create: `app/api/companion/me/route.ts`, `app/api/companion/catalog/route.ts`, `app/api/companion/devices/route.ts`, `app/api/companion/import/route.ts`, `app/api/companion/apply/route.ts`, `lib/api/companion.ts` (shared wrapper)

**Interfaces (HTTP, all JSON):**

- `GET /api/companion/me` → `{ user: { id, name, email }, device?: never }`
- `GET /api/companion/catalog` → `{ games: PublicCatalogEntry[] }` (public data, but auth is still required so the route cannot be scraped anonymously)
- `PUT /api/companion/devices` body `{ device: string; games: { source; appId; name; installDir? }[] }` → `{ stored: number }`
- `POST /api/companion/import` body `{ catalogId; device; files; name? }` → `{ url, gameSlug, presetSlug, missingFiles, unmappedSettings, warnings }`
- `POST /api/companion/apply` body `{ catalogId; presetSlug; files }` → `{ files, changed, skipped }`
- Errors: `{ error: string }` with 400 (validation), 401 (token), 404 (`AppError`), 500.

- [ ] **Step 1: `lib/api/companion.ts`**

```ts
import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireCompanionUser } from "@/lib/auth/companion";
import { UnauthorizedError } from "@/lib/auth/session";
import { AppError } from "@/lib/data/errors";

/** Auth + validate + map errors, so each route is just its body. */
export function companionRoute<S extends z.ZodType | null, T>(
  schema: S,
  fn: (input: S extends z.ZodType ? z.output<S> : null, userId: string, req: Request) => Promise<T>,
) {
  return async (req: Request) => {
    try {
      const userId = await requireCompanionUser(req);
      let input: unknown = null;
      if (schema) {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
          const i = parsed.error.issues[0];
          return NextResponse.json(
            { error: `${i?.path.join(".") || "body"}: ${i?.message}` },
            { status: 400 },
          );
        }
        input = parsed.data;
      }
      return NextResponse.json(await fn(input as never, userId, req));
    } catch (error) {
      if (error instanceof UnauthorizedError)
        return NextResponse.json({ error: error.message }, { status: 401 });
      if (error instanceof AppError)
        return NextResponse.json({ error: error.message }, { status: 404 });
      console.error("[gsv:companion]", error);
      return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
    }
  };
}
```

- [ ] **Step 2: Routes**

`me/route.ts`:

```ts
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { companionRoute } from "@/lib/api/companion";
export const GET = companionRoute(null, async (_i, userId) => {
  const u = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { id: true, name: true, email: true },
  });
  return { user: u };
});
```

`catalog/route.ts`:

```ts
import { publicCatalog } from "@/lib/catalog";
import { companionRoute } from "@/lib/api/companion";
export const GET = companionRoute(null, async () => ({ games: publicCatalog() }));
```

`devices/route.ts`:

```ts
import { z } from "zod";
import { replaceDeviceGames } from "@/lib/data/devices";
import { companionRoute } from "@/lib/api/companion";
const body = z.object({
  device: z.string().trim().min(1).max(60),
  games: z
    .array(
      z.object({
        source: z.enum(["steam", "epic"]),
        appId: z.string().min(1).max(80),
        name: z.string().trim().min(1).max(200),
        installDir: z.string().max(500).nullish(),
      }),
    )
    .max(2000),
});
export const PUT = companionRoute(body, async (v, userId) => ({
  stored: await replaceDeviceGames(userId, v.device, v.games),
}));
```

`import/route.ts`:

```ts
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { importConfigFiles } from "@/lib/data/catalog";
import { catalogIdSchema, configFilesSchema } from "@/lib/validation";
import { companionRoute } from "@/lib/api/companion";
const body = z.object({
  catalogId: catalogIdSchema,
  device: z.string().trim().max(60).optional(),
  files: configFilesSchema,
  name: z.string().trim().max(80).optional(),
});
export const POST = companionRoute(body, async (v, userId) => {
  const r = await importConfigFiles(userId, v);
  revalidatePath("/", "layout");
  const { preset: _p, ...read } = r.read;
  return {
    url: `/games/${r.gameSlug}/${r.presetSlug}`,
    gameSlug: r.gameSlug,
    presetSlug: r.presetSlug,
    ...read,
  };
});
```

`apply/route.ts`:

```ts
import { z } from "zod";
import { patchConfigFiles } from "@/lib/data/catalog";
import { catalogIdSchema, configFilesSchema } from "@/lib/validation";
import { companionRoute } from "@/lib/api/companion";
const body = z.object({
  catalogId: catalogIdSchema,
  presetSlug: z.string().min(1).max(120),
  files: configFilesSchema,
});
export const POST = companionRoute(body, (v, userId) => patchConfigFiles(userId, v));
```

- [ ] **Step 3: `proxy.ts`** already excludes `/api` from the cookie redirect — confirm the matcher `(?!api|…)` still holds.

- [ ] **Step 4: Verify with curl** (dev server running, token from Task 10):

```bash
T=gsv_…; U=http://localhost:3000
curl -s -H "Authorization: Bearer $T" $U/api/companion/me
curl -s -H "Authorization: Bearer $T" $U/api/companion/catalog | head -c 300
curl -s -X PUT -H "Authorization: Bearer $T" -H 'content-type: application/json' -d '{"device":"test","games":[{"source":"steam","appId":"730","name":"Counter-Strike 2"}]}' $U/api/companion/devices
curl -s -H "Authorization: Bearer nope" $U/api/companion/me   # → 401
```

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(companion): API routes for me, catalog, devices, import and apply"`

### Task 12: Companion CLI

**Files:**

- Create: `companion/package.json`, `companion/README.md`, `companion/bin/gsv.mjs`, `companion/lib/config.mjs`, `companion/lib/api.mjs`, `companion/lib/paths.mjs`, `companion/lib/scan.mjs`, `companion/lib/vdf.mjs`
- Modify: `package.json` (root script `"gsv": "node companion/bin/gsv.mjs"`), `eslint.config.mjs` (no change needed — plain JS lints under the Next config; if React rules fire on `.mjs`, add `companion/**` to `globalIgnores`)
- Test: `companion/test/vdf.test.mjs` run with `node --test companion/test`

**Interfaces (module exports):**

- `config.mjs`: `loadConfig(): { url; token; device } | null`, `saveConfig(c)`, `configPath()`
- `api.mjs`: `api(config)` → `{ get(path), put(path, body), post(path, body) }` — throws `Error(message)` with the server's `error` text on non-2xx.
- `vdf.mjs`: `parseVdf(text): object` (same grammar as `lib/game-configs/formats/keyvalues.ts`, duplicated on purpose: the CLI has no build step and no access to the app's TypeScript)
- `paths.mjs`: `steamRoots(): string[]`, `steamUserdata(): string | null`, `documentsFor(kind: "steam-linux"|"steam-windows"|"epic-linux"|"epic-windows", game): string | null`, `resolveFilePath(file, game): { platform, path } | null`
- `scan.mjs`: `scanSteam(): { source:"steam", appId, name, installDir }[]`, `scanEpic(): { source:"epic", appId, name, installDir }[]`

- [ ] **Step 1: `companion/package.json`**

```json
{
  "name": "gsv-companion",
  "version": "0.1.0",
  "description": "GameSettings Vault companion: scan installed games, import and apply config files.",
  "license": "MIT",
  "type": "module",
  "bin": { "gsv": "./bin/gsv.mjs" },
  "engines": { "node": ">=20" },
  "scripts": { "test": "node --test test" }
}
```

- [ ] **Step 2: `companion/lib/vdf.mjs` + test**

Port `parseKeyValues` from Task 5 verbatim to JS (`tokenize`, `unquote`, `parseVdf`). Test `companion/test/vdf.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseVdf } from "../lib/vdf.mjs";

test("parses libraryfolders.vdf shape", () => {
  const doc = parseVdf(
    '"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"/home/me/.steam/steam"\n\t\t"apps"\n\t\t{\n\t\t\t"730"\t\t"123"\n\t\t}\n\t}\n}\n',
  );
  assert.equal(doc.libraryfolders["0"].path, "/home/me/.steam/steam");
  assert.equal(doc.libraryfolders["0"].apps["730"], "123");
});
```

Run: `node --test companion/test` → PASS.

- [ ] **Step 3: `companion/lib/config.mjs`**

```js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";

export function configPath() {
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
      : (process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"));
  return join(base, "gsv", "config.json");
}

export function loadConfig() {
  const p = configPath();
  if (!existsSync(p)) return null;
  const c = JSON.parse(readFileSync(p, "utf8"));
  return { device: hostname(), ...c };
}

export function saveConfig(config) {
  const p = configPath();
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  return p;
}
```

- [ ] **Step 4: `companion/lib/api.mjs`**

```js
export function api({ url, token }) {
  const base = url.replace(/\/$/, "");
  async function call(method, path, body) {
    const res = await fetch(`${base}/api/companion${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!res.ok) throw new Error(json?.error ?? `${res.status} ${res.statusText}`);
    return json;
  }
  return {
    get: (p) => call("GET", p),
    put: (p, b) => call("PUT", p, b),
    post: (p, b) => call("POST", p, b),
  };
}
```

- [ ] **Step 5: `companion/lib/paths.mjs`**

```js
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseVdf } from "./vdf.mjs";

const home = homedir();
const win = process.platform === "win32";

/** Steam installs, in the order we trust them. */
export function steamRoots() {
  const candidates = win
    ? [
        join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Steam"),
        join(process.env.ProgramFiles ?? "C:\\Program Files", "Steam"),
      ]
    : [
        join(home, ".steam", "steam"),
        join(home, ".local", "share", "Steam"),
        join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
      ];
  const seen = new Set();
  return candidates.filter((p) => {
    if (!existsSync(join(p, "steamapps"))) return false;
    const real = statSync(p).ino; // ~/.steam/steam is usually a symlink to ~/.local/share/Steam
    if (seen.has(real)) return false;
    seen.add(real);
    return true;
  });
}

/** All steamapps library folders (main + extra drives). */
export function steamLibraries() {
  const libs = [];
  for (const root of steamRoots()) {
    libs.push(join(root, "steamapps"));
    const vdf = join(root, "steamapps", "libraryfolders.vdf");
    if (!existsSync(vdf)) continue;
    const doc = parseVdf(readFileSync(vdf, "utf8")).libraryfolders ?? {};
    for (const entry of Object.values(doc))
      if (entry?.path) libs.push(join(entry.path, "steamapps"));
  }
  return [...new Set(libs)].filter((p) => existsSync(p));
}

/** The most recently used Steam account's userdata dir. */
export function steamUserdata() {
  for (const root of steamRoots()) {
    const dir = join(root, "userdata");
    if (!existsSync(dir)) continue;
    const ids = readdirSync(dir).filter((d) => /^\d+$/.test(d) && d !== "0");
    if (ids.length === 0) continue;
    ids.sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs);
    return join(dir, ids[0]);
  }
  return null;
}

function protonDocuments(appId) {
  for (const lib of steamLibraries()) {
    const users = join(lib, "compatdata", String(appId), "pfx", "drive_c", "users");
    if (existsSync(users)) return join(users, "steamuser", "Documents");
  }
  return null;
}

function heroicDocuments(appName) {
  const cfg = join(
    process.env.XDG_CONFIG_HOME ?? join(home, ".config"),
    "heroic",
    "GamesConfig",
    `${appName}.json`,
  );
  let prefix = null;
  if (existsSync(cfg)) prefix = JSON.parse(readFileSync(cfg, "utf8"))[appName]?.winePrefix ?? null;
  if (!prefix) {
    const def = join(home, "Games", "Heroic", "Prefixes");
    if (existsSync(def)) {
      const dirs = readdirSync(def).filter((d) => existsSync(join(def, d, "drive_c")));
      prefix = dirs.length ? join(def, dirs[0]) : null; // ponytail: first prefix; fine for one Epic game
    }
  }
  if (!prefix) return null;
  const users = join(prefix, "drive_c", "users");
  if (!existsSync(users)) return null;
  const user = readdirSync(users).find(
    (u) => u !== "Public" && existsSync(join(users, u, "Documents")),
  );
  return user ? join(users, user, "Documents") : null;
}

/** Where `{documents}` points for a given launcher/OS combination. */
export function documentsFor(kind, game) {
  if (kind === "steam-windows" || kind === "epic-windows")
    return join(process.env.USERPROFILE ?? home, "Documents");
  if (kind === "steam-linux") return game.steamAppId ? protonDocuments(game.steamAppId) : null;
  if (kind === "epic-linux") return game.epicAppName ? heroicDocuments(game.epicAppName) : null;
  return null;
}

const ORDER = win ? ["steam-windows", "epic-windows"] : ["steam-linux", "epic-linux"];

/** First platform whose placeholders resolve and whose file exists. */
export function resolveFilePath(file, game) {
  for (const platform of ORDER) {
    const template = file.paths[platform];
    if (!template) continue;
    const userdata = steamUserdata();
    const documents = documentsFor(platform, game);
    const path = template
      .replace("{steam_userdata}", userdata ?? "\u0000")
      .replace("{documents}", documents ?? "\u0000");
    if (path.includes("\u0000")) continue;
    if (existsSync(path)) return { platform, path };
  }
  return null;
}
```

- [ ] **Step 6: `companion/lib/scan.mjs`**

```js
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseVdf } from "./vdf.mjs";
import { steamLibraries } from "./paths.mjs";

const NOT_GAMES = /^(Proton|Steam Linux Runtime|Steamworks Common Redistributables)/;

export function scanSteam() {
  const out = [];
  for (const lib of steamLibraries()) {
    for (const f of readdirSync(lib).filter((n) => /^appmanifest_\d+\.acf$/.test(n))) {
      const app = parseVdf(readFileSync(join(lib, f), "utf8")).AppState;
      if (!app?.name || NOT_GAMES.test(app.name)) continue;
      out.push({
        source: "steam",
        appId: String(app.appid),
        name: app.name,
        installDir: join(lib, "common", app.installdir ?? ""),
      });
    }
  }
  return out;
}

export function scanEpic() {
  const out = [];
  if (process.platform === "win32") {
    const dir = join(
      process.env.ProgramData ?? "C:\\ProgramData",
      "Epic",
      "EpicGamesLauncher",
      "Data",
      "Manifests",
    );
    if (!existsSync(dir)) return out;
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".item"))) {
      const m = JSON.parse(readFileSync(join(dir, f), "utf8"));
      if (m.AppName && m.DisplayName)
        out.push({
          source: "epic",
          appId: m.AppName,
          name: m.DisplayName,
          installDir: m.InstallLocation ?? null,
        });
    }
    return out;
  }
  const installed = join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "heroic",
    "legendaryConfig",
    "legendary",
    "installed.json",
  );
  if (!existsSync(installed)) return out;
  for (const g of Object.values(JSON.parse(readFileSync(installed, "utf8")))) {
    if (g?.app_name && g?.title)
      out.push({
        source: "epic",
        appId: g.app_name,
        name: g.title.replace(/[®™]/g, "").trim(),
        installDir: g.install_path ?? null,
      });
  }
  return out;
}
```

- [ ] **Step 7: `companion/bin/gsv.mjs`**

```js
#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { api } from "../lib/api.mjs";
import { configPath, loadConfig, saveConfig } from "../lib/config.mjs";
import { resolveFilePath } from "../lib/paths.mjs";
import { scanEpic, scanSteam } from "../lib/scan.mjs";

const HELP = `gsv — GameSettings Vault companion

  gsv login <url>                      pair this machine with your vault (paste a token from Settings → Companion)
  gsv scan [--push]                    list installed Steam/Epic games; --push sends them to the vault
  gsv import <game> [--name "…"]       read the game's config files into a new preset (game: cs2, rocket-league…)
  gsv apply <game> <preset> [--dry-run] write a preset into the game's config files (backs up first)
  gsv games                            list catalog games and whether their files were found here

Close the game before import/apply. Steam Cloud may restore old files for some games.`;

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const args = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1] === "--name"));

function need() {
  const c = loadConfig();
  if (!c) {
    console.error("Not logged in. Run: gsv login <url>");
    process.exit(2);
  }
  return c;
}

async function login() {
  const url = args[0];
  if (!url) return console.error("Usage: gsv login <url>");
  const rl = createInterface({ input: stdin, output: stdout });
  const token = (await rl.question(`Token from ${url}/settings#companion: `)).trim();
  rl.close();
  const me = await api({ url, token }).get("/me");
  const path = saveConfig({ url, token });
  console.log(`Logged in as ${me.user.email}. Saved to ${path}`);
}

async function scan() {
  const games = [...scanSteam(), ...scanEpic()].sort((a, b) => a.name.localeCompare(b.name));
  for (const g of games) console.log(`${g.source.padEnd(5)} ${g.appId.padEnd(10)} ${g.name}`);
  console.log(`\n${games.length} games found.`);
  if (!flag("push")) return console.log("Add --push to send this list to your vault.");
  const c = need();
  const r = await api(c).put("/devices", { device: c.device, games });
  console.log(`Sent ${r.stored} games as "${c.device}".`);
}

async function catalogGame(c, id) {
  const { games } = await api(c).get("/catalog");
  const g = games.find((x) => x.id === id);
  if (!g) {
    console.error(`Unknown game "${id}". Known: ${games.map((x) => x.id).join(", ")}`);
    process.exit(2);
  }
  return g;
}

function readFiles(g) {
  const files = {};
  const found = [];
  for (const f of g.files) {
    const hit = resolveFilePath(f, g);
    if (!hit) {
      console.log(`  ${f.id}: not found on this machine`);
      continue;
    }
    files[f.id] = readFileSync(hit.path, "utf8");
    found.push({ id: f.id, path: hit.path });
    console.log(`  ${f.id}: ${hit.path}`);
  }
  return { files, found };
}

async function games() {
  const c = need();
  const { games } = await api(c).get("/catalog");
  for (const g of games) {
    console.log(`${g.id} — ${g.name}`);
    readFiles(g);
  }
}

async function importCmd() {
  const c = need();
  const g = await catalogGame(c, args[0]);
  console.log(`Reading ${g.name} files:`);
  const { files } = readFiles(g);
  if (Object.keys(files).length === 0) {
    console.error("No config files found. Is the game installed and has it been run once?");
    process.exit(1);
  }
  const r = await api(c).post("/import", {
    catalogId: g.id,
    device: c.device,
    files,
    name: opt("name"),
  });
  console.log(`\nCreated preset: ${c.url}${r.url}`);
  if (r.missingFiles.length)
    console.log(`Files not found (defaults kept): ${r.missingFiles.join(", ")}`);
  if (r.unmappedSettings.length)
    console.log(
      `${r.unmappedSettings.length} settings aren't stored in files — enter them by hand (e.g. ${r.unmappedSettings[0]}).`,
    );
  for (const w of r.warnings) console.log(`Warning: ${w}`);
}

async function apply() {
  const c = need();
  const [gameId, presetSlug] = args;
  if (!presetSlug) return console.error("Usage: gsv apply <game> <preset-slug> [--dry-run]");
  const g = await catalogGame(c, gameId);
  console.log(`Reading current ${g.name} files:`);
  const { files, found } = readFiles(g);
  const r = await api(c).post("/apply", { catalogId: g.id, presetSlug, files });
  for (const [id, keys] of Object.entries(r.changed))
    console.log(
      `\n${id}: ${Object.entries(keys)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  for (const s of r.skipped) console.log(`Skipped — ${s}`);
  if (flag("dry-run")) return console.log("\nDry run: nothing written.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const { id, path } of found) {
    if (!r.files[id]) continue;
    copyFileSync(path, `${path}.bak-${stamp}`);
    writeFileSync(path, r.files[id]);
    console.log(`Wrote ${path} (backup: ${path}.bak-${stamp})`);
  }
  console.log("\nDone. If the game was open, close it and apply again.");
}

const commands = { login, scan, games, import: importCmd, apply };
if (!cmd || !commands[cmd]) {
  console.log(HELP);
  process.exit(cmd ? 2 : 0);
}
commands[cmd]().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
```

`chmod +x companion/bin/gsv.mjs`. Root `package.json`: add `"gsv": "node companion/bin/gsv.mjs"` to scripts.

- [ ] **Step 8: `companion/README.md`** — install (`npm i -g ./companion` or `pnpm gsv …` from the repo), the five commands, where config lives, the two warnings (close the game; Steam Cloud). Also add `companion/**` to `.prettierignore`? No — keep it formatted; run `pnpm exec prettier --write companion`.

- [ ] **Step 9: Verify on this machine** (dev server on :3000, token created in Settings):

```bash
pnpm gsv login http://localhost:3000        # paste token → "Logged in as …"
pnpm gsv scan                               # lists Counter-Strike 2 (steam 730) and Rocket League (epic Sugar), no Proton entries
pnpm gsv scan --push                        # "Sent 2 games"
pnpm gsv games                              # cs2: 3 files found; rocket-league: 2 files found
pnpm gsv import cs2                         # prints preset URL; open it: Resolution 1280×960, Toggle Console = p
pnpm gsv import rocket-league               # Video imported; "N settings aren't stored in files"
pnpm gsv apply cs2 imported-<date> --dry-run # shows changed keys, nothing written
```

Then in the vault change Wait for Vertical Sync on that preset, run `pnpm gsv apply cs2 imported-<date>` with CS2 closed, confirm `setting.mat_vsync` changed in `cs2_video.txt` and a `.bak-*` sits next to it. Restore by copying the backup back.

- [ ] **Step 10: Commit** — `git add -A && git commit -m "feat(companion): gsv CLI — login, scan, games, import, apply"`

### Task 13: Docs, README, CI, e2e

**Files:**

- Create: `docs/companion.md`, `docs/catalog.md`
- Modify: `README.md` (features + "Companion" section), `docs/architecture/overview.md` (catalog + game-configs + companion in the map and request flow), `docs/import-export.md` (`catalogId`), `.github/workflows/ci.yml` (`node --test companion/test`), `CONTRIBUTING.md` ("Adding a game to the catalog" → link `docs/catalog.md`)

- [ ] **Step 1: `docs/catalog.md`** — how to add a game: file layout, exact-name rule, `files` entry, the four `source` shapes with one example each (copy from the spec), how to find keys (change one setting in the game, diff the file), test with `tests/game-configs.test.ts` fixtures, and the "no copying UI art" rule from §10.
- [ ] **Step 2: `docs/companion.md`** — install, commands, config location, path resolution per launcher/OS (table), safety (backup, close game, Steam Cloud), token management, troubleshooting ("not found on this machine" → run the game once; Heroic prefix not detected → set `winePrefix` in Heroic).
- [ ] **Step 3: README** — add bullets _Real menus from the catalog (CS2, Rocket League)_ and _Companion CLI: scan installed games, import and apply config files_; a short "Companion" section with the four commands.
- [ ] **Step 4: CI** — after `pnpm check`: `- run: node --test companion/test`.
- [ ] **Step 5: e2e** — the catalog assertion from Task 4 is in; add after it: go to `/import?tab=files`, choose CS2, upload `tests/fixtures/cs2_video.txt` via `setInputFiles`, expect the preview text `will be created`, click "Import as preset", expect URL `**/games/counter-strike-2/imported-*` and Resolution shows `1280`.
- [ ] **Step 6: Verify** — `pnpm check`, `pnpm exec prettier --check .`, `pnpm exec playwright test`, `node --test companion/test` all PASS.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "docs: catalog and companion guides; CI runs companion tests"`

---

## Self-review notes

- Spec §A catalog → Tasks 2–4; §B formats/mapping/web → Tasks 5–8; §C search/devices → Task 9; §D companion/tokens/routes/settings → Tasks 10–12; docs/testing → Task 13. Manual validation on this machine is Task 12 Step 9.
- Names used across tasks: `readGameConfig`/`writeGameConfig`/`ConfigFiles` (7, 8, 11), `importConfigFiles`/`patchConfigFiles` (8, 11), `publicCatalog`/`PublicCatalogEntry`/`getCatalogGame`/`catalogToGameDoc` (2, 4, 8, 9, 11, 12), `configFilesSchema`/`catalogIdSchema` (8, 9, 11), `replaceDeviceGames`/`listDeviceGames`/`listDevices` (9, 10, 11), `requireCompanionUser` (10, 11), `createdPresetSlugs` (8).
- Deliberate simplifications marked `ponytail:` in code: keybind read when a default key was rebound away; last-writer-wins on key collisions; Heroic prefix picks the first one when `GamesConfig` has no `winePrefix`.
