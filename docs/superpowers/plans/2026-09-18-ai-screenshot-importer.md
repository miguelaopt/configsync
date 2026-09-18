# AI Screenshot Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Pro user uploads screenshots of a game's settings menu on a preset page and gets every visible setting proposed next to its current value, reviews the rows, and applies the ones they confirm.

**Architecture:** One Anthropic vision provider (`@anthropic-ai/sdk`, structured outputs) returns what it read as text; a pure core module matches proposals to the preset's own settings by normalised name and coerces values to each setting's type; a raw-body route handler analyses one image per request under a Pro-only rolling 24 h cap; a review dialog on the preset page applies confirmed rows through the existing validated write paths (`updateSettingValues`, `createSetting`, `createRevision`).

**Tech Stack:** Next.js 16 (App Router, server actions, route handlers), TypeScript, Drizzle + Postgres, zod 4, `@anthropic-ai/sdk` 0.126, vitest, Radix UI primitives already wrapped in `components/ui`.

**Spec:** `docs/superpowers/specs/2026-09-18-ai-screenshot-importer-design.md`

## Global Constraints

- Feature is hidden when `AI_VISION_PROVIDER` is unset; self-hosting without AI keeps working.
- Plan gate: `limitsFor(plan).aiScreenshots` — `free: 0`, `pro: 30` images per rolling 24 h.
- Model default `claude-opus-5`, overridable with `AI_VISION_MODEL`. Effort `low`. `max_tokens: 8000`.
- Images: PNG/JPEG/WebP only, sniffed by magic bytes, ≤ 2 MB on the server; client downsizes to ≤ 1568 px long edge WebP q0.85; 1–5 per run.
- Nothing is written without the user ticking a row and pressing Apply. Every write goes through `updateSettingValues` / `createSetting` (validated against the setting definition).
- The screenshot is never stored; one `ai_requests` row per analysed image.
- Work on branch `feat/ai-screenshot-importer`, push, open a PR against `main` (never merge locally).
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- This is a Next.js 16 codebase whose APIs may differ from your training data. Read `node_modules/next/dist/docs/` before touching route handlers or server actions if anything looks unfamiliar.
- Run `pnpm typecheck` after each task; `pnpm check` (typecheck + lint + tests) before the PR.

---

## File map

| File | Responsibility |
| --- | --- |
| `lib/env.ts` (modify) | `AI_VISION_*` variables, `screenshotAssistantEnabled` |
| `lib/billing/limits.ts` (modify) | `aiScreenshots` cap and the two messages |
| `lib/billing/public.ts` (modify) | Pricing copy |
| `lib/settings/coerce.ts` (create) | `coerceValue(def, raw)` — on-screen text → typed, validated value |
| `lib/providers/screenshot.ts` (rewrite) | Provider contract types + `getScreenshotParser()` switch |
| `lib/providers/anthropic-vision.ts` (create) | `createAnthropicParser(client, model)`, prompt, error mapping |
| `lib/ai/screenshot.ts` (create) | `buildHints`, `matchProposals`, `mergeRows`, `ScreenshotRow` (pure, browser-safe) |
| `lib/db/schema.ts` + `drizzle/0004_ai_requests.sql` | `ai_requests` table |
| `lib/data/ai.ts` (create) | `assertCanAnalyse`, `analyseScreenshot`, `applyScreenshotRows` |
| `lib/data/settings.ts` (modify) | `tx` parameter on `getCategory`, `createSetting`, `updateSettingValues` |
| `app/api/ai/screenshot/route.ts` (create) | `POST ?preset=<id>` raw image body → `{ rows }` |
| `lib/actions/ai.ts` (create) | `applyScreenshotAction` |
| `components/presets/screenshot-dialog.tsx` (create) | Pick → analysing → review → apply |
| `components/presets/preset-actions.tsx`, `preset-header.tsx`, `app/(app)/games/[gameSlug]/[presetSlug]/page.tsx` (modify) | Menu item and prop plumbing |
| `tests/coerce.test.ts`, `tests/screenshot-match.test.ts`, `tests/anthropic-vision.test.ts`, `tests/billing.test.ts` | Unit tests |
| `.env.example`, `docs/architecture/ai-providers.md`, `docs/self-hosting.md` | Docs |

---

### Task 0: Branch

- [ ] **Step 1: Check out the feature branch (it already exists, carrying the spec and this plan on top of `origin/main`)**

```bash
cd /home/miguelferreira/Desktop/Settings_Saver
git checkout feat/ai-screenshot-importer
git log --oneline -3   # expect: plan, spec, then the PR #4 merge
```

---

### Task 1: Environment, limits and pricing copy

**Files:**
- Modify: `lib/env.ts`
- Modify: `lib/billing/limits.ts`
- Modify: `lib/billing/public.ts:20`
- Modify: `.env.example` (last block)
- Test: `tests/billing.test.ts:22-27`

**Interfaces:**
- Produces: `env.AI_VISION_PROVIDER?: "anthropic"`, `env.AI_VISION_API_KEY?: string`, `env.AI_VISION_MODEL: string`, `screenshotAssistantEnabled: boolean` (from `@/lib/env`); `LIMITS[plan].aiScreenshots: number`, `AI_LIMIT_MESSAGE`, `AI_DAILY_MESSAGE` (from `@/lib/billing/limits`).

- [ ] **Step 1: Update the limits test to expect the new field**

In `tests/billing.test.ts` replace the `limits` describe block with:

```ts
describe("limits", () => {
  it("free is 3 games, 10 snapshots and no AI; pro is unlimited with 30 screenshots a day", () => {
    expect(limitsFor("free")).toEqual({ games: 3, revisions: 10, aiScreenshots: 0 });
    expect(limitsFor("pro")).toEqual({ games: Infinity, revisions: Infinity, aiScreenshots: 30 });
    expect(LIMITS.free.games).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run tests/billing.test.ts`
Expected: FAIL — `aiScreenshots` missing from the received object.

- [ ] **Step 3: Add the limit and messages**

Replace the body of `lib/billing/limits.ts` with:

```ts
export type Plan = "free" | "pro";

/** What Free caps. Everything else is gated by `plan === "pro"` where it applies. */
export const LIMITS: Record<Plan, { games: number; revisions: number; aiScreenshots: number }> = {
  free: { games: 3, revisions: 10, aiScreenshots: 0 },
  pro: { games: Infinity, revisions: Infinity, aiScreenshots: 30 },
};

export const limitsFor = (plan: Plan) => LIMITS[plan];

export const GAME_LIMIT_MESSAGE = `Free keeps up to ${LIMITS.free.games} active games. Archive one or upgrade to Pro.`;
/** Contains "upgrade to Pro" so `toastError` adds its "See plans" action. */
export const AI_LIMIT_MESSAGE = "Screenshot import is a Pro feature — upgrade to Pro to use it.";
export const AI_DAILY_MESSAGE = `You've analysed ${LIMITS.pro.aiScreenshots} screenshots in the last 24 hours. Try again later.`;
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run tests/billing.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the environment variables**

In `lib/env.ts`, add to the `z.object({...})` after the `PADDLE_PRICE_LIFETIME` line:

```ts
  AI_VISION_PROVIDER: z.enum(["anthropic"]).optional(),
  AI_VISION_API_KEY: z.string().optional(),
  AI_VISION_MODEL: z.string().default("claude-opus-5"),
```

Then chain a refine onto the object so the schema declaration becomes:

```ts
const schema = z
  .object({
    // …existing fields…
  })
  .refine((e) => !e.AI_VISION_PROVIDER || Boolean(e.AI_VISION_API_KEY), {
    message: "AI_VISION_API_KEY is required when AI_VISION_PROVIDER is set",
    path: ["AI_VISION_API_KEY"],
  });
```

In `load()`, add the empty-string normalisation next to the Paddle ones:

```ts
    AI_VISION_PROVIDER: process.env.AI_VISION_PROVIDER || undefined,
    AI_VISION_API_KEY: process.env.AI_VISION_API_KEY || undefined,
    AI_VISION_MODEL: process.env.AI_VISION_MODEL || undefined,
```

At the bottom of the file add:

```ts
/** Whether the screenshot importer is offered at all. Off ⇒ the UI never mentions it. */
export const screenshotAssistantEnabled = Boolean(env.AI_VISION_PROVIDER);
```

- [ ] **Step 6: Pricing copy and `.env.example`**

`lib/billing/public.ts`: change `"AI screenshot importer (coming soon)"` to `"AI screenshot importer (30 screenshots a day)"`.

`.env.example`: replace the last block with:

```
# --- Optional: AI screenshot importer (Pro) --------------------------------
# Reads screenshots of a game's settings menu and proposes values. Off when unset.
# Only "anthropic" ships; see docs/architecture/ai-providers.md
AI_VISION_PROVIDER=
AI_VISION_API_KEY=
# AI_VISION_MODEL=claude-opus-5
```

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck && pnpm vitest run tests/billing.test.ts`
Expected: both clean.

```bash
git add lib/env.ts lib/billing/limits.ts lib/billing/public.ts .env.example tests/billing.test.ts
git commit -m "feat(ai): env, plan limit and pricing copy for the screenshot importer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Value coercion

**Files:**
- Create: `lib/settings/coerce.ts`
- Test: `tests/coerce.test.ts`

**Interfaces:**
- Consumes: `valueSchemaFor(def)`, `SettingDefinition`, `SettingValue` from `@/lib/settings/types`.
- Produces: `coerceValue(def: SettingDefinition, raw: string): SettingValue | null`.

- [ ] **Step 1: Write the failing tests**

`tests/coerce.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { coerceValue } from "@/lib/settings/coerce";
import type { SettingDefinition } from "@/lib/settings/types";

const def = (
  type: SettingDefinition["type"],
  extra: Partial<SettingDefinition> = {},
): SettingDefinition => ({ type, ...extra });
const quality = def("enum", {
  options: [
    { label: "High", value: "high" },
    { label: "Low", value: "low" },
  ],
});

describe("coerceValue", () => {
  it("reads booleans from the words games use", () => {
    expect(coerceValue(def("boolean"), "On")).toBe(true);
    expect(coerceValue(def("boolean"), "Disabled")).toBe(false);
    expect(coerceValue(def("boolean"), "Maybe")).toBeNull();
  });

  it("reads numbers, strips units, accepts a decimal comma and honours the definition's range", () => {
    expect(coerceValue(def("integer"), "400 DPI")).toBe(400);
    expect(coerceValue(def("decimal"), "0,85")).toBe(0.85);
    expect(coerceValue(def("percentage"), "85%")).toBe(85);
    expect(coerceValue(def("integer"), "2.5")).toBeNull();
    expect(coerceValue(def("slider", { min: 0, max: 1 }), "1.5")).toBeNull();
    expect(coerceValue(def("percentage"), "150")).toBeNull();
  });

  it("matches choices by label or value, case-insensitively", () => {
    expect(coerceValue(quality, "HIGH")).toBe("high");
    expect(coerceValue(quality, "low")).toBe("low");
    expect(coerceValue(quality, "Ultra")).toBeNull();
    expect(coerceValue(def("dropdown"), "Anything")).toBe("Anything");
    expect(coerceValue(def("multi_select", { options: quality.options }), "High, Low")).toEqual([
      "high",
      "low",
    ]);
    expect(coerceValue(def("multi_select", { options: quality.options }), "High, Ultra")).toBeNull();
  });

  it("reads resolutions and colours, keeps free text trimmed, rejects blanks", () => {
    expect(coerceValue(def("resolution"), "1920 x 1080")).toEqual({ width: 1920, height: 1080 });
    expect(coerceValue(def("resolution"), "2560×1440")).toEqual({ width: 2560, height: 1440 });
    expect(coerceValue(def("resolution"), "1080p")).toBeNull();
    expect(coerceValue(def("color"), "FF8800")).toBe("#ff8800");
    expect(coerceValue(def("color"), "orange")).toBeNull();
    expect(coerceValue(def("keybind"), " Mouse 4 ")).toBe("Mouse 4");
    expect(coerceValue(def("text"), "   ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm vitest run tests/coerce.test.ts`
Expected: FAIL — cannot resolve `@/lib/settings/coerce`.

- [ ] **Step 3: Implement**

`lib/settings/coerce.ts`:

```ts
import { valueSchemaFor, type SettingDefinition, type SettingValue } from "./types";

const TRUE = new Set(["on", "yes", "true", "enabled", "1"]);
const FALSE = new Set(["off", "no", "false", "disabled", "0"]);
const NUMBER = /-?\d+(?:[.,]\d+)?/;
const RESOLUTION = /(\d{3,5})\s*[x×*]\s*(\d{3,5})/i;
const HEX = /^#?([0-9a-f]{6})$/i;

/**
 * Turns on-screen text ("On", "1920x1080", "High") into a typed value for `def`.
 * Null when the text can't be read as that type or fails the definition's own rules.
 */
export function coerceValue(def: SettingDefinition, raw: string): SettingValue | null {
  const text = raw.trim();
  if (!text) return null;
  const value = parse(def, text);
  if (value == null) return null;
  return valueSchemaFor(def).safeParse(value).success ? value : null;
}

function parse(def: SettingDefinition, text: string): SettingValue | null {
  const lower = text.toLowerCase();
  switch (def.type) {
    case "boolean":
      return TRUE.has(lower) ? true : FALSE.has(lower) ? false : null;
    case "integer":
    case "decimal":
    case "slider":
    case "percentage": {
      const m = NUMBER.exec(text);
      if (!m) return null;
      // ponytail: a single comma is read as a decimal separator ("0,85"); "1,000" becomes 1.
      const n = Number(m[0].replace(",", "."));
      if (!Number.isFinite(n)) return null;
      return def.type === "integer" && !Number.isInteger(n) ? null : n;
    }
    case "dropdown":
    case "enum":
      return option(def, text);
    case "multi_select": {
      const parts = text.split(",").map((p) => option(def, p.trim()));
      return parts.every((p): p is string => p != null) ? parts : null;
    }
    case "resolution": {
      const m = RESOLUTION.exec(text);
      return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
    }
    case "color": {
      const m = HEX.exec(text);
      return m ? `#${m[1]!.toLowerCase()}` : null;
    }
    case "text":
    case "long_text":
    case "keybind":
    case "controller_binding":
    case "info":
      return text;
  }
}

function option(def: SettingDefinition, text: string): string | null {
  const options = def.options ?? [];
  if (options.length === 0) return text;
  const lower = text.toLowerCase();
  return (
    options.find((o) => o.label.toLowerCase() === lower || o.value.toLowerCase() === lower)
      ?.value ?? null
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run tests/coerce.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/settings/coerce.ts tests/coerce.test.ts
git commit -m "feat(settings): coerce on-screen text into typed setting values

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Provider contract and matching core

**Files:**
- Rewrite: `lib/providers/screenshot.ts`
- Create: `lib/ai/screenshot.ts`
- Test: `tests/screenshot-match.test.ts`

**Interfaces:**
- Consumes: `coerceValue` (Task 2); `CategoryWithSettings` type from `@/lib/data/presets`.
- Produces (from `@/lib/providers/screenshot`): `ScreenshotImage`, `ScreenshotHints`, `ProposedSetting`, `ParseResult`, `ScreenshotParser`, `getScreenshotParser()` (returns `null` until Task 4 wires the provider).
- Produces (from `@/lib/ai/screenshot`): `ScreenshotRow`, `normalise`, `buildHints`, `matchProposals`, `mergeRows`.

- [ ] **Step 1: Rewrite the contract file**

Replace `lib/providers/screenshot.ts` entirely with:

```ts
/**
 * Screenshot importer — provider contract.
 *
 * Flow: the user uploads a screenshot of a settings menu → the parser returns what it read
 * (setting names and on-screen values, as text) → lib/ai/screenshot.ts matches them to the
 * preset's own settings and coerces the values → the user reviews every row → only rows the
 * user confirms are saved.
 *
 * Providers are selected by AI_VISION_PROVIDER. See docs/architecture/ai-providers.md.
 */
import "server-only";
import type { SettingTypeId } from "@/lib/settings/types";

export type ScreenshotImage = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

/** What the model is told about the preset so it can reuse exact names. */
export type ScreenshotHints = {
  gameName: string;
  categories: {
    name: string;
    settings: { name: string; type: SettingTypeId; options?: string[]; unit?: string | null }[];
  }[];
};

/** One thing the model read. Values are on-screen text; the core coerces them to setting types. */
export type ProposedSetting = {
  /** Exact existing name when the label matches one of the hints, else the on-screen label. */
  name: string;
  /** "On", "1920x1080", "0.85", "High", "Mouse 4", … */
  rawValue: string;
  /** Heading or tab the setting appeared under. */
  category: string | null;
  /** Best-effort guess, only meaningful for names not in the hints. */
  type: SettingTypeId | null;
  /** 0–1. */
  confidence: number;
};

export type ParseResult = {
  proposals: ProposedSetting[];
  usage: { inputTokens: number; outputTokens: number; model: string };
};

export interface ScreenshotParser {
  readonly id: string;
  parse(image: ScreenshotImage, hints: ScreenshotHints): Promise<ParseResult>;
}

/**
 * Resolves the configured parser, or null when AI is not configured so callers can hide
 * the feature instead of failing. Adding a provider = implement ScreenshotParser + a case here.
 */
export function getScreenshotParser(): ScreenshotParser | null {
  return null;
}
```

- [ ] **Step 2: Write the failing matching tests**

`tests/screenshot-match.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildHints, matchProposals, mergeRows, type ScreenshotRow } from "@/lib/ai/screenshot";
import type { CategoryWithSettings } from "@/lib/data/presets";
import type { ProposedSetting } from "@/lib/providers/screenshot";

type S = CategoryWithSettings["settings"][number];
const setting = (id: string, name: string, type: S["type"], extra: Partial<S> = {}) =>
  ({ id, name, type, value: null, options: null, min: null, max: null, step: null, unit: null, ...extra }) as S;
const cat = (id: string, name: string, settings: S[]) => ({ id, name, settings }) as CategoryWithSettings;

const categories = [
  cat("c1", "Video", [
    setting("s1", "Resolution", "resolution"),
    setting("s2", "V-Sync", "boolean", { value: false }),
    setting("s3", "Brightness", "slider", { min: 0, max: 100 }),
  ]),
  cat("c2", "Audio", [setting("s4", "Brightness", "percentage")]),
];
const proposal = (over: Partial<ProposedSetting>): ProposedSetting => ({
  name: "",
  rawValue: "",
  category: null,
  type: null,
  confidence: 0.9,
  ...over,
});

describe("matchProposals", () => {
  it("matches by normalised name, coerces to the setting's type and keeps preset order", () => {
    const rows = matchProposals(
      [proposal({ name: "v sync", rawValue: "On" }), proposal({ name: "RESOLUTION", rawValue: "2560×1440" })],
      categories,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        settingId: "s1",
        name: "Resolution",
        value: { width: 2560, height: 1440 },
        def: expect.objectContaining({ type: "resolution" }),
        current: null,
      }),
      expect.objectContaining({ settingId: "s2", value: true, current: false }),
    ]);
  });

  it("breaks name ties with the category heading and falls back to the first setting", () => {
    expect(matchProposals([proposal({ name: "Brightness", category: "audio", rawValue: "50" })], categories)[0]!.settingId).toBe("s4");
    expect(matchProposals([proposal({ name: "Brightness", rawValue: "50" })], categories)[0]!.settingId).toBe("s3");
  });

  it("keeps unreadable values as null with the raw text, and unknown names as new rows", () => {
    const rows = matchProposals(
      [
        proposal({ name: "V-Sync", rawValue: "Adaptive" }),
        proposal({ name: "Motion Blur", rawValue: "Off", type: "boolean", category: "Video" }),
      ],
      categories,
    );
    expect(rows[0]).toMatchObject({ settingId: "s2", value: null, rawValue: "Adaptive" });
    expect(rows[1]).toMatchObject({
      settingId: null,
      name: "Motion Blur",
      def: { type: "boolean" },
      value: false,
      category: "Video",
      current: null,
    });
  });

  it("clamps confidence, dedupes repeated rows and defaults unknown rows to text", () => {
    const rows = matchProposals(
      [
        proposal({ name: "Crosshair", rawValue: "Dynamic", confidence: 7 }),
        proposal({ name: "V-Sync", rawValue: "Off", confidence: 0.3 }),
        proposal({ name: "V-Sync", rawValue: "On", confidence: 0.8 }),
      ],
      categories,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ settingId: "s2", value: true, confidence: 0.8 });
    expect(rows[1]).toMatchObject({ confidence: 1, def: { type: "text" }, value: "Dynamic" });
  });
});

describe("mergeRows", () => {
  const row = (over: Partial<ScreenshotRow>): ScreenshotRow => ({
    name: "x",
    category: null,
    confidence: 0.5,
    rawValue: "",
    settingId: null,
    def: { type: "text" },
    current: null,
    value: "",
    ...over,
  });
  it("keeps the most confident duplicate across images and lists matched rows first", () => {
    const merged = mergeRows([
      [row({ name: "New thing" }), row({ settingId: "s1", value: 1, confidence: 0.4 })],
      [row({ settingId: "s1", value: 2, confidence: 0.9 }), row({ name: "new  THING", confidence: 0.2 })],
    ]);
    expect(merged).toEqual([
      expect.objectContaining({ settingId: "s1", value: 2 }),
      expect.objectContaining({ name: "New thing", confidence: 0.5 }),
    ]);
  });
});

describe("buildHints", () => {
  it("lists option labels and units per setting", () => {
    const hints = buildHints({ name: "CS2" }, [
      cat("c", "Video", [
        setting("s", "Texture quality", "enum", {
          options: [
            { label: "Low", value: "low" },
            { label: "High", value: "high" },
          ],
        }),
        setting("t", "FPS cap", "integer", { unit: "fps" }),
      ]),
    ]);
    expect(hints).toEqual({
      gameName: "CS2",
      categories: [
        {
          name: "Video",
          settings: [
            { name: "Texture quality", type: "enum", options: ["Low", "High"], unit: null },
            { name: "FPS cap", type: "integer", options: undefined, unit: "fps" },
          ],
        },
      ],
    });
  });
});
```

- [ ] **Step 3: Run to see it fail**

Run: `pnpm vitest run tests/screenshot-match.test.ts`
Expected: FAIL — cannot resolve `@/lib/ai/screenshot`.

- [ ] **Step 4: Implement the core**

`lib/ai/screenshot.ts` (no runtime server imports — the dialog uses `mergeRows` in the browser):

```ts
import { coerceValue } from "@/lib/settings/coerce";
import type { SettingDefinition, SettingValue } from "@/lib/settings/types";
import type { ProposedSetting, ScreenshotHints } from "@/lib/providers/screenshot";
import type { CategoryWithSettings } from "@/lib/data/presets";

/** One reviewable line: an update to an existing setting (settingId set) or a new setting. */
export type ScreenshotRow = {
  name: string;
  category: string | null;
  confidence: number;
  rawValue: string;
  settingId: string | null;
  /** Matched: the setting's own definition. New: `{ type }` from the model's guess or "text". */
  def: SettingDefinition;
  /** Matched only. */
  current: SettingValue | null;
  /** Coerced and valid for `def`; null when the text couldn't be read as that type. */
  value: SettingValue | null;
};

type Setting = CategoryWithSettings["settings"][number];

export const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

const definitionOf = (s: Setting): SettingDefinition => ({
  type: s.type,
  min: s.min,
  max: s.max,
  step: s.step,
  options: s.options,
  unit: s.unit,
});

export function buildHints(
  game: { name: string },
  categories: CategoryWithSettings[],
): ScreenshotHints {
  return {
    gameName: game.name,
    categories: categories.map((c) => ({
      name: c.name,
      settings: c.settings.map((s) => ({
        name: s.name,
        type: s.type,
        options: s.options?.length ? s.options.map((o) => o.label) : undefined,
        unit: s.unit ?? null,
      })),
    })),
  };
}

/** Matches what the model read to the preset's settings; unmatched names become "new" rows. */
export function matchProposals(
  proposals: ProposedSetting[],
  categories: CategoryWithSettings[],
): ScreenshotRow[] {
  type Candidate = { setting: Setting; category: string; order: number };
  const index = new Map<string, Candidate[]>();
  let order = 0;
  for (const c of categories)
    for (const s of c.settings) {
      const key = normalise(s.name);
      index.set(key, [...(index.get(key) ?? []), { setting: s, category: c.name, order: order++ }]);
    }

  const matched: { order: number; row: ScreenshotRow }[] = [];
  const fresh: ScreenshotRow[] = [];
  for (const p of proposals) {
    const confidence = clamp(p.confidence);
    const candidates = index.get(normalise(p.name));
    if (!candidates) {
      const def: SettingDefinition = { type: p.type ?? "text" };
      fresh.push({
        name: p.name.trim(),
        category: p.category,
        confidence,
        rawValue: p.rawValue,
        settingId: null,
        def,
        current: null,
        value: coerceValue(def, p.rawValue),
      });
      continue;
    }
    const wanted = p.category ? normalise(p.category) : null;
    const { setting, category, order } =
      candidates.find((c) => wanted && normalise(c.category) === wanted) ?? candidates[0]!;
    const def = definitionOf(setting);
    matched.push({
      order,
      row: {
        name: setting.name,
        category,
        confidence,
        rawValue: p.rawValue,
        settingId: setting.id,
        def,
        current: (setting.value as SettingValue | null) ?? null,
        value: coerceValue(def, p.rawValue),
      },
    });
  }
  matched.sort((a, b) => a.order - b.order);
  return mergeRows([[...matched.map((m) => m.row), ...fresh]]);
}

/** Rows from one or more images: the same setting keeps its most confident reading; matched rows first. */
export function mergeRows(batches: ScreenshotRow[][]): ScreenshotRow[] {
  const seen = new Map<string, ScreenshotRow>();
  for (const row of batches.flat()) {
    const key = row.settingId ?? `new:${normalise(row.name)}`;
    const prev = seen.get(key);
    if (!prev || row.confidence > prev.confidence) seen.set(key, row);
  }
  const rows = [...seen.values()];
  return [...rows.filter((r) => r.settingId), ...rows.filter((r) => !r.settingId)];
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run tests/screenshot-match.test.ts tests/coerce.test.ts`
Expected: PASS.

Note: `tests/screenshot-match.test.ts` imports only types from `@/lib/providers/screenshot` and `@/lib/data/presets`, so their `server-only` imports are erased. If vitest still complains about `server-only`, a runtime import slipped in — fix the import to `import type`.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm typecheck`
Expected: clean (nothing imports `OCRProvider`/`VisionProvider`; `grep -rn "OCRProvider\|VisionProvider" lib app components` returns nothing).

```bash
git add lib/providers/screenshot.ts lib/ai/screenshot.ts tests/screenshot-match.test.ts
git commit -m "feat(ai): screenshot parser contract and proposal matching core

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Anthropic vision provider

**Files:**
- Create: `lib/providers/anthropic-vision.ts`
- Modify: `lib/providers/screenshot.ts` (`getScreenshotParser`)
- Modify: `package.json` (dependency)
- Test: `tests/anthropic-vision.test.ts`

**Interfaces:**
- Consumes: contract types from Task 3; `env` from `@/lib/env`; `AppError` from `@/lib/data/errors`; `SETTING_TYPE_IDS` from `@/lib/settings/types`.
- Produces: `createAnthropicParser(client: ParseClient, model: string): ScreenshotParser`, `renderHints(hints): string`, `ParseClient` type; `getScreenshotParser()` now returns the Anthropic parser when `env.AI_VISION_PROVIDER === "anthropic"`.

- [ ] **Step 1: Install the SDK and confirm the helper exists**

```bash
pnpm add @anthropic-ai/sdk
node -e "const m=require('@anthropic-ai/sdk/helpers/zod'); console.log(typeof m.zodOutputFormat)"
grep -n "parse(" node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts | head -3
```

Expected: `function` and at least one `parse(` overload. If `zodOutputFormat` is missing or rejects zod 4 at typecheck time, use the fallback in Step 4.

- [ ] **Step 2: Write the failing provider test**

`tests/anthropic-vision.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import {
  createAnthropicParser,
  renderHints,
  type ParseClient,
} from "@/lib/providers/anthropic-vision";
import type { ScreenshotHints } from "@/lib/providers/screenshot";

const hints: ScreenshotHints = {
  gameName: "Counter-Strike 2",
  categories: [
    {
      name: "Video",
      settings: [
        { name: "Resolution", type: "resolution" },
        { name: "Texture Quality", type: "enum", options: ["Low", "High"] },
        { name: "FPS cap", type: "integer", unit: "fps" },
      ],
    },
  ],
};
const image = { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/webp" as const };

const clientWith = (response: Record<string, unknown>) => {
  const parse = vi.fn(async () => ({
    stop_reason: "end_turn",
    model: "claude-opus-5",
    usage: { input_tokens: 1200, output_tokens: 80 },
    ...response,
  }));
  return { client: { messages: { parse } } as unknown as ParseClient, parse };
};

describe("renderHints", () => {
  it("lists one setting per line with type, options and unit", () => {
    const text = renderHints(hints);
    expect(text).toContain("Game: Counter-Strike 2");
    expect(text).toContain("Video › Resolution (resolution)");
    expect(text).toContain("Video › Texture Quality (enum; options: Low | High)");
    expect(text).toContain("Video › FPS cap (integer; unit: fps)");
  });
});

describe("createAnthropicParser", () => {
  it("sends the image and hints, maps the structured output and clamps confidence", async () => {
    const { client, parse } = clientWith({
      parsed_output: {
        settings: [
          { name: "Resolution", value: "1920x1080", category: "Video", type: null, confidence: 0.95 },
          { name: "Motion Blur", value: "Off", category: "Video", type: "boolean", confidence: 3 },
        ],
      },
    });
    const result = await createAnthropicParser(client, "claude-opus-5").parse(image, hints);
    expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 80, model: "claude-opus-5" });
    expect(result.proposals).toEqual([
      { name: "Resolution", rawValue: "1920x1080", category: "Video", type: null, confidence: 0.95 },
      { name: "Motion Blur", rawValue: "Off", category: "Video", type: "boolean", confidence: 1 },
    ]);
    const req = parse.mock.calls[0]![0] as { model: string; messages: { content: { type: string; source?: { data: string; media_type: string }; text?: string }[] }[] };
    expect(req.model).toBe("claude-opus-5");
    expect(req.messages[0]!.content[0]).toMatchObject({ type: "image", source: { media_type: "image/webp", data: Buffer.from([1, 2, 3]).toString("base64") } });
    expect(req.messages[0]!.content[1]!.text).toContain("Video › Resolution");
  });

  it("returns no proposals on refusal or unparsable output", async () => {
    const refused = clientWith({ stop_reason: "refusal", parsed_output: null }).client;
    expect((await createAnthropicParser(refused, "m").parse(image, hints)).proposals).toEqual([]);
    const broken = clientWith({ parsed_output: null }).client;
    expect((await createAnthropicParser(broken, "m").parse(image, hints)).proposals).toEqual([]);
  });

  it("turns SDK errors into user-safe messages", async () => {
    const auth = Anthropic.APIError.generate(401, { error: { message: "bad key" } }, "bad key", new Headers());
    const client = { messages: { parse: vi.fn(async () => { throw auth; }) } } as unknown as ParseClient;
    await expect(createAnthropicParser(client, "m").parse(image, hints)).rejects.toMatchObject({
      name: "AppError",
      message: expect.stringContaining("AI_VISION_API_KEY"),
    });
    const busy = Anthropic.APIError.generate(429, { error: { message: "slow down" } }, "slow down", new Headers());
    const client2 = { messages: { parse: vi.fn(async () => { throw busy; }) } } as unknown as ParseClient;
    await expect(createAnthropicParser(client2, "m").parse(image, hints)).rejects.toMatchObject({
      message: expect.stringContaining("busy"),
    });
  });
});
```

- [ ] **Step 3: Run to see it fail**

Run: `pnpm vitest run tests/anthropic-vision.test.ts`
Expected: FAIL — cannot resolve `@/lib/providers/anthropic-vision`.

- [ ] **Step 4: Implement the provider**

`lib/providers/anthropic-vision.ts` (no `env` import here so tests can run it without a `.env`):

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AppError } from "@/lib/data/errors";
import { SETTING_TYPE_IDS } from "@/lib/settings/types";
import type { ScreenshotHints, ScreenshotParser } from "./screenshot";

const outputSchema = z.object({
  settings: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      category: z.string().nullable(),
      type: z.enum(SETTING_TYPE_IDS).nullable(),
      confidence: z.number(),
    }),
  ),
});

const SYSTEM = `You read screenshots of video-game settings menus and transcribe the settings shown.

Rules:
- Include only settings whose current value is visible. Skip rows that are cut off, blurred or unreadable.
- You receive the list of settings the user already tracks for this game. When an on-screen label is one of them (synonyms and abbreviations count), use that exact name. Otherwise use the label as written on screen.
- Copy values exactly as displayed, for example "On", "1920x1080", "0.85", "High", "Mouse 4". Never convert units or add precision.
- "category" is the heading or tab the setting appears under, or null.
- "type" is your best guess only for settings that are not in the list; use null for settings that are.
- "confidence" (0–1) reflects how legible the value is and how sure you are of the name.`;

/** The slice of the SDK client the parser uses; tests pass a fake. */
export type ParseClient = { messages: { parse: Anthropic["messages"]["parse"] } };

export function createAnthropicParser(client: ParseClient, model: string): ScreenshotParser {
  return {
    id: "anthropic",
    async parse(image, hints) {
      let response: Awaited<ReturnType<ParseClient["messages"]["parse"]>>;
      try {
        response = await client.messages.parse({
          model,
          max_tokens: 8000,
          system: SYSTEM,
          output_config: { effort: "low", format: zodOutputFormat(outputSchema) },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: image.mimeType,
                    data: Buffer.from(image.bytes).toString("base64"),
                  },
                },
                { type: "text", text: renderHints(hints) },
              ],
            },
          ],
        });
      } catch (error) {
        throw toAppError(error);
      }
      const usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
      };
      const parsed = response.stop_reason === "refusal" ? null : response.parsed_output;
      if (!parsed) return { proposals: [], usage };
      return {
        usage,
        proposals: parsed.settings.map((s) => ({
          name: s.name,
          rawValue: s.value,
          category: s.category,
          type: s.type,
          confidence: Math.min(1, Math.max(0, s.confidence)),
        })),
      };
    },
  };
}

/** `Category › Setting (type; options: a | b; unit: x)` — one line per tracked setting. */
export function renderHints(h: ScreenshotHints): string {
  const lines = h.categories.flatMap((c) =>
    c.settings.map((s) => {
      const parts = [
        s.type,
        s.options?.length ? `options: ${s.options.join(" | ")}` : null,
        s.unit ? `unit: ${s.unit}` : null,
      ].filter(Boolean);
      return `${c.name} › ${s.name} (${parts.join("; ")})`;
    }),
  );
  return `Game: ${h.gameName}\n\nSettings the user tracks:\n${lines.join("\n") || "(none yet)"}`;
}

function toAppError(error: unknown): unknown {
  if (error instanceof Anthropic.AuthenticationError)
    return new AppError(
      "The AI provider rejected the server's API key. Ask the administrator to check AI_VISION_API_KEY.",
    );
  if (error instanceof Anthropic.RateLimitError)
    return new AppError("The AI provider is busy. Try again in a minute.");
  if (error instanceof Anthropic.APIError)
    return new AppError("The AI provider returned an error. Try again.");
  return error;
}
```

**Fallback if `zodOutputFormat` is unavailable or rejects zod 4:** replace `client.messages.parse` with `client.messages.create` (and `ParseClient` with `{ messages: { create: Anthropic["messages"]["create"] } }`), pass `format: { type: "json_schema", schema: z.toJSONSchema(outputSchema) }`, then take the first `text` block, `JSON.parse` it and validate with `outputSchema.safeParse` — a failed parse behaves like `parsed_output == null`. Adjust the test's fake to return `content: [{ type: "text", text: JSON.stringify({ settings: [...] }) }]` instead of `parsed_output`.

- [ ] **Step 5: Wire the provider into `getScreenshotParser`**

In `lib/providers/screenshot.ts` add the imports and replace the function:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { createAnthropicParser } from "./anthropic-vision";
```

```ts
let parser: ScreenshotParser | null | undefined;

export function getScreenshotParser(): ScreenshotParser | null {
  if (parser !== undefined) return parser;
  switch (env.AI_VISION_PROVIDER) {
    case "anthropic":
      parser = createAnthropicParser(
        new Anthropic({ apiKey: env.AI_VISION_API_KEY, timeout: 60_000, maxRetries: 1 }),
        env.AI_VISION_MODEL,
      );
      break;
    default:
      parser = null;
  }
  return parser;
}
```

(`anthropic-vision.ts` imports only types from `./screenshot`, so the cycle is erased at compile time.)

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm vitest run tests/anthropic-vision.test.ts && pnpm typecheck`
Expected: PASS, typecheck clean. If `ParseClient`'s `parse` type makes `response.parsed_output` untyped, annotate: `const parsed = ... as z.infer<typeof outputSchema> | null`.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml lib/providers/anthropic-vision.ts lib/providers/screenshot.ts tests/anthropic-vision.test.ts
git commit -m "feat(ai): Anthropic vision provider with structured output

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `ai_requests` table and the data layer

**Files:**
- Modify: `lib/db/schema.ts` (after `deviceGames`)
- Create: `drizzle/0004_ai_requests.sql` (generated)
- Modify: `lib/data/settings.ts:27-33` (`getCategory`), `:146-156` (`createSetting`), `:183-211` (`updateSettingValues`)
- Create: `lib/data/ai.ts`

**Interfaces:**
- Consumes: `getScreenshotParser`, `buildHints`, `matchProposals`, `ScreenshotRow`; `getPlan`, `limitsFor`, messages (Task 1); `getPresetFull`, `getGameById`, `createRevision`.
- Produces: `schema.aiRequests`; `assertCanAnalyse(userId)`, `analyseScreenshot(userId, presetId, image): Promise<{ rows: ScreenshotRow[] }>`, `applyScreenshotRows(userId, presetId, updates, creates): Promise<{ updated: number; created: number }>`, `ScreenshotCreate` type; `createSetting(userId, input, tx?)`, `updateSettingValues(userId, presetId, updates, tx?)`.

- [ ] **Step 1: Add the table**

In `lib/db/schema.ts`, after the `deviceGames` table:

```ts
// ---------------------------------------------------------------------------
// AI: one row per analysed screenshot (rolling daily cap + cost per user)
// ---------------------------------------------------------------------------

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("ai_requests_user_created_idx").on(t.userId, t.createdAt)],
);
```

- [ ] **Step 2: Generate and apply the migration**

```bash
pnpm db:generate --name ai_requests
cat drizzle/0004_ai_requests.sql
pnpm db:migrate
```

Expected: the SQL creates only `ai_requests` and its index (if it touches anything else, the schema drifted — stop and look). Migration applies against the Docker Postgres (`docker compose up -d db` if it is not running).

- [ ] **Step 3: Thread `tx` through the settings writes**

In `lib/data/settings.ts`:

```ts
async function getCategory(userId: string, categoryId: string, tx: Tx | typeof db = db) {
  const row = await tx.query.categories.findFirst({
    where: and(eq(categories.userId, userId), eq(categories.id, categoryId)),
  });
  if (!row) throw notFound("category");
  return row;
}
```

```ts
export async function createSetting(userId: string, input: SettingInput, tx: Tx | typeof db = db) {
  const category = await getCategory(userId, input.categoryId, tx);
  assertValueValid(input, input.value);
  assertValueValid(input, input.defaultValue);
  const next = await nextPosition(tx, settings, eq(settings.categoryId, category.id));
  const [row] = await tx
    .insert(settings)
    .values({ ...input, userId, presetId: category.presetId, position: next })
    .returning();
  return row!;
}
```

```ts
/** Batch value update from inline editing. Validates each value against its own definition. */
export async function updateSettingValues(
  userId: string,
  presetId: string,
  updates: { id: string; value?: SettingValue | null | undefined }[],
  tx: Tx | typeof db = db,
) {
  if (updates.length === 0) return;
  await getPresetById(userId, presetId, tx);
  const ids = updates.map((u) => u.id);
  const rows = await tx
    .select()
    .from(settings)
    .where(
      and(eq(settings.userId, userId), eq(settings.presetId, presetId), inArray(settings.id, ids)),
    );
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const u of updates) {
    const def = byId.get(u.id);
    if (!def) throw notFound("setting");
    assertValueValid(def, u.value);
  }
  // Inside an outer transaction this is a savepoint; standalone it is a transaction.
  await tx.transaction(async (t) => {
    for (const u of updates) {
      await t
        .update(settings)
        .set({ value: u.value ?? null })
        .where(and(eq(settings.id, u.id), eq(settings.userId, userId)));
    }
  });
}
```

- [ ] **Step 4: Write the data module**

`lib/data/ai.ts`:

```ts
import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getPlan } from "@/lib/billing/plan";
import { AI_DAILY_MESSAGE, AI_LIMIT_MESSAGE, limitsFor } from "@/lib/billing/limits";
import { getScreenshotParser, type ScreenshotImage } from "@/lib/providers/screenshot";
import { buildHints, matchProposals, type ScreenshotRow } from "@/lib/ai/screenshot";
import type { SettingTypeId, SettingValue } from "@/lib/settings/types";
import { AppError } from "./errors";
import { getGameById } from "./games";
import { getPresetFull } from "./presets";
import { createRevision } from "./revisions";
import { createSetting, updateSettingValues } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Throws when the plan has no screenshot quota or the rolling 24 h cap is reached. */
export async function assertCanAnalyse(userId: string) {
  const max = limitsFor((await getPlan(userId)).plan).aiScreenshots;
  if (max === 0) throw new AppError(AI_LIMIT_MESSAGE, "forbidden");
  const [row] = await db
    .select({ n: count() })
    .from(schema.aiRequests)
    .where(
      and(
        eq(schema.aiRequests.userId, userId),
        gte(schema.aiRequests.createdAt, new Date(Date.now() - DAY_MS)),
      ),
    );
  if ((row?.n ?? 0) >= max) throw new AppError(AI_DAILY_MESSAGE, "forbidden");
}

/** Sends one image to the configured parser and matches the result to the preset. */
export async function analyseScreenshot(
  userId: string,
  presetId: string,
  image: ScreenshotImage,
): Promise<{ rows: ScreenshotRow[] }> {
  const parser = getScreenshotParser();
  if (!parser) throw new AppError("Screenshot import isn't configured on this server.");
  // ponytail: the cap is checked before the call and counted after, so a parallel burst can
  // overshoot by a few images. Insert the row first (and delete on failure) if that ever matters.
  await assertCanAnalyse(userId);
  const preset = await getPresetFull(userId, presetId);
  const game = await getGameById(userId, preset.gameId);
  const { proposals, usage } = await parser.parse(image, buildHints(game, preset.categories));
  await db.insert(schema.aiRequests).values({
    userId,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return { rows: matchProposals(proposals, preset.categories) };
}

export type ScreenshotCreate = {
  categoryId: string;
  name: string;
  type: SettingTypeId;
  value: SettingValue | null;
};

/** Writes the rows the user confirmed (validated by the settings layer), then snapshots the preset. */
export async function applyScreenshotRows(
  userId: string,
  presetId: string,
  updates: { id: string; value?: SettingValue | null }[],
  creates: ScreenshotCreate[],
) {
  await db.transaction(async (tx) => {
    await updateSettingValues(userId, presetId, updates, tx);
    for (const c of creates) await createSetting(userId, c, tx);
  });
  await createRevision(userId, presetId, "Imported from screenshot");
  return { updated: updates.length, created: creates.length };
}
```

Note: `createSetting` asserts the category belongs to the user; it does **not** check the category belongs to `presetId`. Add that guard here rather than trusting the client: before the transaction, load `getPresetFull(userId, presetId)` and throw `new AppError("That category isn't in this preset.")` if any `c.categoryId` is not among `preset.categories.map((c) => c.id)`.

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm typecheck && pnpm vitest run`
Expected: clean; all tests pass.

```bash
git add lib/db/schema.ts drizzle lib/data/settings.ts lib/data/ai.ts
git commit -m "feat(ai): ai_requests table, daily cap and screenshot data layer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Route handler and apply action

**Files:**
- Create: `app/api/ai/screenshot/route.ts`
- Create: `lib/actions/ai.ts`

**Interfaces:**
- Consumes: `analyseScreenshot`, `applyScreenshotRows` (Task 5); `detectImageType` from `@/lib/data/attachments`; `getSession` from `@/lib/auth/session`; `runAction` from `./shared`.
- Produces: `POST /api/ai/screenshot?preset=<uuid>` → `200 { rows: ScreenshotRow[] }` | `4xx/5xx { error }`; `applyScreenshotAction(raw): ActionResult<{ updated: number; created: number }>`.

- [ ] **Step 1: Route handler**

`app/api/ai/screenshot/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { analyseScreenshot } from "@/lib/data/ai";
import { detectImageType } from "@/lib/data/attachments";
import { AppError } from "@/lib/data/errors";
import { id } from "@/lib/validation";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"] as const;
type Accepted = (typeof ACCEPTED)[number];
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const STATUS = { forbidden: 403, not_found: 404, conflict: 409, invalid: 400 } as const;

/** Analyse one screenshot against a preset: raw image body ≤ 2 MB, type sniffed. Pro only. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("Sign in to import screenshots.", 401);
  const presetId = id.safeParse(new URL(req.url).searchParams.get("preset"));
  if (!presetId.success) return fail("Missing preset.", 400);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES)
    return fail("Screenshots must be 2 MB or smaller.", 413);
  try {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return fail("Screenshots must be 2 MB or smaller.", 413);
    const mimeType = detectImageType(bytes);
    if (!mimeType || !ACCEPTED.includes(mimeType as Accepted))
      return fail("Use a PNG, JPEG or WebP screenshot.", 400);
    const result = await analyseScreenshot(session.user.id, presetId.data, {
      bytes,
      mimeType: mimeType as Accepted,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) return fail(error.message, STATUS[error.code]);
    console.error("[csync:ai]", error);
    return fail("Couldn't analyse that screenshot. Try again.", 500);
  }
}
```

- [ ] **Step 2: Apply action**

`lib/actions/ai.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applyScreenshotRows } from "@/lib/data/ai";
import { AppError } from "@/lib/data/errors";
import { settingValueSchema } from "@/lib/import-export/schema";
import { settingTypeSchema } from "@/lib/settings/types";
import { id, settingValueUpdateSchema } from "@/lib/validation";
import { runAction } from "./shared";

const schema = z.object({
  presetId: id,
  updates: z.array(settingValueUpdateSchema).max(1000).default([]),
  creates: z
    .array(
      z.object({
        categoryId: id,
        name: z.string().trim().min(1, "Setting name is required").max(120),
        type: settingTypeSchema,
        value: settingValueSchema.nullish(),
      }),
    )
    .max(200)
    .default([]),
});

/** Saves the rows the user ticked in the screenshot review. */
export async function applyScreenshotAction(raw: unknown) {
  return runAction(schema, raw, async (v, userId) => {
    if (v.updates.length + v.creates.length === 0) throw new AppError("Nothing selected.");
    const creates = v.creates.map((c) => ({ ...c, value: c.value ?? null }));
    const result = await applyScreenshotRows(userId, v.presetId, v.updates, creates);
    revalidatePath("/", "layout");
    return result;
  });
}
```

- [ ] **Step 3: Smoke-test the route without a session**

```bash
pnpm dev &   # if not already running
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:3000/api/ai/screenshot?preset=00000000-0000-0000-0000-000000000000" --data-binary @package.json
```

Expected: `401`. (Signed-in behaviour is verified through the UI in Task 8.)

- [ ] **Step 4: Typecheck and commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add app/api/ai/screenshot/route.ts lib/actions/ai.ts
git commit -m "feat(ai): screenshot analysis route and apply action

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Review dialog and menu entry

**Files:**
- Create: `components/presets/screenshot-dialog.tsx`
- Modify: `components/presets/preset-actions.tsx` (props, menu item, dialog)
- Modify: `components/presets/preset-header.tsx` (prop passthrough)
- Modify: `app/(app)/games/[gameSlug]/[presetSlug]/page.tsx` (build the `ai` prop)

**Interfaces:**
- Consumes: `mergeRows`, `ScreenshotRow`, `normalise` from `@/lib/ai/screenshot`; `applyScreenshotAction`; `SettingControl` (`components/settings/setting-control.tsx`: props `def, value, onChange, id, label, disabled?, layout?`); `formatValue`, `SETTING_TYPES`, `SETTING_TYPE_IDS`; `screenshotAssistantEnabled` from `@/lib/env`; `getPlan`.
- Produces: `ScreenshotMenuProps = { enabled: boolean; pro: boolean; categories: { id: string; name: string }[] }` exported from `screenshot-dialog.tsx` and accepted as `ai?: ScreenshotMenuProps | null` by `PresetActionsMenu` and `PresetHeader`.

- [ ] **Step 1: The dialog**

`components/presets/screenshot-dialog.tsx`:

```tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { applyScreenshotAction } from "@/lib/actions/ai";
import { mergeRows, normalise, type ScreenshotRow } from "@/lib/ai/screenshot";
import {
  formatValue,
  SETTING_TYPE_IDS,
  SETTING_TYPES,
  type SettingTypeId,
} from "@/lib/settings/types";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingControl } from "@/components/settings/setting-control";
import { toastError } from "@/components/ui/toaster";
import { plural } from "@/lib/utils/format";

export type ScreenshotMenuProps = {
  enabled: boolean;
  pro: boolean;
  categories: { id: string; name: string }[];
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetId: string;
  pro: boolean;
  categories: { id: string; name: string }[];
};

/** A row plus its review state. `key` is stable across merges (settingId or normalised name). */
type Row = ScreenshotRow & { key: string; checked: boolean; categoryId: string | null };
type Phase = "pick" | "analysing" | "review";

const MAX_FILES = 5;
const MAX_EDGE = 1568;
const PRIVACY =
  "Screenshots are sent to Anthropic to read the settings. They are analysed once and not stored.";

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Upload screenshots of the game's settings menu, review what was read, apply what you tick. */
export function ScreenshotDialog({ open, onOpenChange, presetId, pro, categories }: Props) {
  const router = useRouter();
  const [files, setFiles] = React.useState<File[]>([]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [phase, setPhase] = React.useState<Phase>("pick");
  const [pending, startTransition] = React.useTransition();

  const reset = () => {
    setFiles([]);
    setRows([]);
    setPhase("pick");
  };
  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const toRow = (r: ScreenshotRow): Row => {
    if ("key" in r) return r as Row; // survived a merge: keep the user's edits
    const guess = r.category
      ? categories.find((c) => normalise(c.name) === normalise(r.category!))
      : undefined;
    return {
      ...r,
      key: r.settingId ?? `new:${normalise(r.name)}`,
      checked: r.settingId != null && r.value != null && r.confidence >= 0.5 && !same(r.value, r.current),
      categoryId: guess?.id ?? categories[0]?.id ?? null,
    };
  };

  const analyse = async () => {
    setPhase("analysing");
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const blob = await downscale(file);
          const res = await fetch(`/api/ai/screenshot?preset=${presetId}`, {
            method: "POST",
            body: blob,
            headers: { "Content-Type": blob.type || file.type },
          });
          const json = (await res.json()) as { rows?: ScreenshotRow[]; error?: string };
          if (!res.ok || !json.rows) {
            toastError(json.error ?? `Couldn't analyse ${file.name}.`);
            return null;
          }
          return json.rows;
        } catch {
          toast.error(`Couldn't analyse ${file.name}.`);
          return null;
        }
      }),
    );
    const ok = results.filter((r): r is ScreenshotRow[] => r != null);
    const merged = ok.length ? mergeRows([rows, ...ok]) : rows;
    if (ok.length === 0 || merged.length === 0) {
      if (ok.length > 0) toast.error("No settings found in those screenshots.");
      setPhase(rows.length ? "review" : "pick");
      return;
    }
    setRows(merged.map(toRow));
    setFiles([]);
    setPhase("review");
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const matched = rows.filter((r) => r.settingId);
  const fresh = rows.filter((r) => !r.settingId);
  const selected = rows.filter((r) => r.checked && r.value != null && (r.settingId || r.categoryId));

  const apply = () =>
    startTransition(async () => {
      const r = await applyScreenshotAction({
        presetId,
        updates: selected.filter((r) => r.settingId).map((r) => ({ id: r.settingId!, value: r.value })),
        creates: selected
          .filter((r) => !r.settingId)
          .map((r) => ({ categoryId: r.categoryId!, name: r.name, type: r.def.type, value: r.value })),
      });
      if (!r.ok) return toastError(r.error);
      toast.success(`Applied ${plural(r.data.updated + r.data.created, "setting")} from your screenshots`);
      router.refresh();
      close(false);
    });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title="Import from screenshot"
        description={phase === "review" ? "Tick what to apply. Nothing is saved until you press Apply." : PRIVACY}
        size={phase === "review" ? "lg" : "md"}
      >
        {!pro ? (
          <div className="flex flex-col gap-4 text-[13px] text-ink-2">
            <p>
              Reading settings from screenshots is a Pro feature. Pro also unlocks unlimited games,
              full history and auto-switch.
            </p>
            <Button asChild variant="primary" className="self-start">
              <Link href="/pricing">See Pro</Link>
            </Button>
          </div>
        ) : phase === "analysing" ? (
          <div className="flex items-center gap-2 py-6 text-[13px] text-ink-2" role="status">
            <Loader2 className="size-4 animate-spin" /> Reading {plural(files.length, "screenshot")}…
          </div>
        ) : phase === "pick" ? (
          <div className="flex flex-col gap-4">
            <Input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                if (list.length > MAX_FILES) toast.error(`Up to ${MAX_FILES} screenshots at a time.`);
                setFiles(list.slice(0, MAX_FILES));
              }}
            />
            {files.length ? (
              <ul className="flex flex-wrap gap-2">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`}>
                    <Thumb file={f} />
                  </li>
                ))}
              </ul>
            ) : null}
            <DialogFooter>
              {rows.length ? (
                <Button variant="secondary" onClick={() => setPhase("review")}>
                  Back to review
                </Button>
              ) : null}
              <Button variant="primary" onClick={analyse} disabled={files.length === 0}>
                Analyse
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {matched.length ? (
              <section>
                <h3 className="mb-1 text-xs font-medium tracking-wide text-ink-3 uppercase">In this preset</h3>
                <ul>
                  {matched.map((r) => (
                    <li
                      key={r.key}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-hairline py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
                    >
                      <Checkbox
                        checked={r.checked}
                        disabled={r.value == null}
                        onCheckedChange={(c) => update(r.key, { checked: c === true })}
                        aria-label={`Apply ${r.name}`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[13px]">
                          <span className="truncate font-medium">{r.name}</span>
                          {r.confidence < 0.5 ? <Badge variant="note">Check</Badge> : null}
                        </div>
                        <div className="text-xs text-ink-3">
                          {r.category ? `${r.category} · ` : ""}Now: {formatValue(r.def, r.current)}
                        </div>
                        {r.value == null ? (
                          <div className="text-xs text-note">Read as “{r.rawValue}” — pick the value by hand.</div>
                        ) : null}
                      </div>
                      <div className="col-start-2 sm:col-start-3">
                        <SettingControl
                          id={`ss-${r.key}`}
                          label={r.name}
                          def={r.def}
                          value={r.value}
                          layout="row"
                          onChange={(v) => update(r.key, { value: v, checked: v != null })}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {fresh.length ? (
              <section>
                <h3 className="mb-1 text-xs font-medium tracking-wide text-ink-3 uppercase">Not in this preset</h3>
                {categories.length === 0 ? (
                  <p className="text-[13px] text-ink-2">Add a category to this preset first to create these.</p>
                ) : null}
                <ul>
                  {fresh.map((r) => (
                    <li
                      key={r.key}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-hairline py-2.5"
                    >
                      <Checkbox
                        checked={r.checked}
                        disabled={categories.length === 0 || r.value == null}
                        onCheckedChange={(c) => update(r.key, { checked: c === true })}
                        aria-label={`Create ${r.name}`}
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          value={r.name}
                          maxLength={120}
                          aria-label="Setting name"
                          onChange={(e) => update(r.key, { name: e.target.value })}
                        />
                        <Select
                          value={r.def.type}
                          onValueChange={(t) => update(r.key, { def: { type: t as SettingTypeId }, value: null, checked: false })}
                        >
                          <SelectTrigger aria-label="Type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SETTING_TYPE_IDS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {SETTING_TYPES[t].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={r.categoryId ?? undefined}
                          onValueChange={(c) => update(r.key, { categoryId: c })}
                          disabled={categories.length === 0}
                        >
                          <SelectTrigger aria-label="Category">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="sm:col-span-3">
                          <SettingControl
                            id={`ss-${r.key}`}
                            label={r.name}
                            def={r.def}
                            value={r.value}
                            layout="row"
                            onChange={(v) => update(r.key, { value: v, checked: v != null && categories.length > 0 })}
                          />
                          {r.value == null ? (
                            <div className="mt-1 text-xs text-note">Read as “{r.rawValue}”.</div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <DialogFooter>
              <Button variant="secondary" onClick={() => setPhase("pick")}>
                Add more screenshots
              </Button>
              <Button variant="primary" onClick={apply} loading={pending} disabled={selected.length === 0}>
                Apply {plural(selected.length, "change")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Thumb({ file }: { file: File }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- local object URL
    <img src={url} alt={file.name} className="h-16 rounded-xs border border-line object-cover" />
  ) : null;
}

/** ≤ MAX_EDGE on the long side, re-encoded as WebP; falls back to the original when that's smaller or fails. */
async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
```

Check the `Button` component accepts `loading` (it does — `GameFilesForm` uses it) and that `Select` accepts `disabled` on the root (Radix does; if the wrapper does not forward it, put `disabled` on `SelectTrigger`).

- [ ] **Step 2: Menu entry in `PresetActionsMenu`**

In `components/presets/preset-actions.tsx`:

- Add `ScanText` to the lucide import list and `import { Badge } from "@/components/ui/badge";` and `import { ScreenshotDialog, type ScreenshotMenuProps } from "./screenshot-dialog";`.
- Add to `Props`: `/** Screenshot importer availability; undefined hides the entry (list contexts). */ ai?: ScreenshotMenuProps | null;`, destructure `ai` in the component, add state `const [screenshot, setScreenshot] = React.useState(false);`.
- After the "Game config files…" item (still before the Archive item):

```tsx
          {ai?.enabled ? (
            <DropdownMenuItem onSelect={() => setScreenshot(true)}>
              <ScanText /> Import from screenshot…
              {!ai.pro ? (
                <Badge variant="accent" className="ml-auto">
                  Pro
                </Badge>
              ) : null}
            </DropdownMenuItem>
          ) : null}
```

- After the `ConfigFilesDialog` block:

```tsx
      {ai?.enabled ? (
        <ScreenshotDialog
          open={screenshot}
          onOpenChange={setScreenshot}
          presetId={preset.id}
          pro={ai.pro}
          categories={ai.categories}
        />
      ) : null}
```

- [ ] **Step 3: Pass it through `PresetHeader`**

In `components/presets/preset-header.tsx`: import `type ScreenshotMenuProps` from `./screenshot-dialog`; add `ai?: ScreenshotMenuProps | null;` to `Props`, destructure it, and pass `ai={ai}` to `<PresetActionsMenu …>`.

- [ ] **Step 4: Build the prop on the preset page**

In `app/(app)/games/[gameSlug]/[presetSlug]/page.tsx`:

```ts
import { getPlan } from "@/lib/billing/plan";
import { screenshotAssistantEnabled } from "@/lib/env";
```

Extend the `Promise.all` to `const [preset, siblings, profile, revisions, { plan }] = await Promise.all([…existing four…, getPlan(user.id)]);` and add to `<PresetHeader …>`:

```tsx
          ai={{
            enabled: screenshotAssistantEnabled,
            pro: plan === "pro",
            categories: categories.map((c) => ({ id: c.id, name: c.name })),
          }}
```

- [ ] **Step 5: Typecheck, lint, build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean. A build error mentioning `server-only` means a client file imported a server module at runtime — the only allowed imports from the dialog are `@/lib/ai/screenshot` (pure), `@/lib/actions/ai` (server action) and UI components.

- [ ] **Step 6: Commit**

```bash
git add components/presets/screenshot-dialog.tsx components/presets/preset-actions.tsx components/presets/preset-header.tsx "app/(app)/games/[gameSlug]/[presetSlug]/page.tsx"
git commit -m "feat(ai): screenshot review dialog on the preset page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Docs, manual verification, PR

**Files:**
- Modify: `docs/architecture/ai-providers.md`
- Modify: `docs/self-hosting.md:48` and the "off by default" table row
- Modify: `README.md:70` (one-line description only if it still says "optional screenshot assistant" — make it "the Pro screenshot importer")

- [ ] **Step 1: Rewrite `docs/architecture/ai-providers.md`**

```markdown
# AI providers (optional)

The core app works without AI. The one AI feature is the **screenshot importer** (Pro): on a
preset page, upload screenshots of the game's settings menu and get every visible setting
proposed next to its current value. The user reviews each row; nothing is saved without a tick
and an explicit Apply.

## Rules

1. AI output is a suggestion. Every row is reviewed and confirmed before it is written.
2. Proposals are matched to the preset's own settings by name; values are coerced to the
   setting's type and validated like any manual edit. Unknown names can be created as new settings,
   also only on confirmation.
3. If no provider is configured, the feature is hidden — not broken.
4. Screenshots are analysed once and never stored. One `ai_requests` row (model, tokens) is kept
   per image for the daily cap and cost visibility.

## Configuration

```
AI_VISION_PROVIDER=anthropic   # empty = disabled
AI_VISION_API_KEY=sk-ant-…
AI_VISION_MODEL=claude-opus-5  # optional
```

Keys are read server-side only. The cap is `LIMITS.pro.aiScreenshots` (30 images per rolling
24 h per user) in `lib/billing/limits.ts`; Free has 0. Without Paddle everyone is Pro, so a
self-hosted instance with a key gives every account 30 images a day.

## How it works

1. `components/presets/screenshot-dialog.tsx` downsizes each image in the browser (≤ 1568 px,
   WebP) and POSTs it to `/api/ai/screenshot?preset=<id>` (raw body, ≤ 2 MB, type sniffed).
2. `lib/data/ai.ts` checks the plan and cap, loads the preset, calls the provider with hints
   (game name, categories, setting names/types/options) and records usage.
3. `lib/providers/anthropic-vision.ts` asks the model for structured JSON: name, on-screen
   value, category, type guess, confidence.
4. `lib/ai/screenshot.ts` matches names (case/punctuation-insensitive), coerces values with
   `lib/settings/coerce.ts`, and returns rows with the current value for side-by-side review.
5. `applyScreenshotAction` writes ticked rows through `updateSettingValues` / `createSetting`
   and records a revision "Imported from screenshot".

## Adding a provider

Implement `ScreenshotParser` from `lib/providers/screenshot.ts` (image + hints → proposals +
usage) and add a case to `getScreenshotParser()`. An offline OCR provider fits the same
contract.

## Privacy

Screenshots sent to a hosted model leave the server. The dialog says which provider receives
the image before upload. Self-hosters who don't want that leave `AI_VISION_PROVIDER` unset.
```

- [ ] **Step 2: `docs/self-hosting.md`**

Replace the `AI_VISION_PROVIDER` row with:

```
| `AI_VISION_PROVIDER`   | no       | `anthropic` turns on the Pro screenshot importer; needs `AI_VISION_API_KEY` (optional `AI_VISION_MODEL`). See [ai-providers](architecture/ai-providers.md). |
```

and the feature table row `| AI vision API | Screenshot assistant | off |` → `| AI vision API | Screenshot importer | off |`.

- [ ] **Step 3: Full check**

Run: `pnpm check`
Expected: typecheck, lint and all vitest suites pass.

- [ ] **Step 4: Manual verification (needs `AI_VISION_PROVIDER=anthropic` + `AI_VISION_API_KEY` in `.env`, dev server restarted)**

1. Sign in as a Pro account (`demo@example.com` / `demo-vault-2026` is Pro when Paddle is unset; with Paddle sandbox on, use the account that completed the sandbox checkout).
2. Open CS2 → Default preset → actions menu → "Import from screenshot…". Read the privacy line.
3. Upload a screenshot of CS2's Video settings (take one on this machine: Steam → CS2 → Settings → Video, F12 for a Steam screenshot; it lands under `~/.local/share/Steam/userdata/<id>/760/remote/730/screenshots/`).
4. Expect the "In this preset" section with values pre-ticked where they differ; low-confidence rows show "Check"; unreadable values show "Read as …". Edit one value with the control, untick another.
5. Apply → toast → page refreshes with the new values; History shows "Imported from screenshot".
6. Upload a second, overlapping screenshot with "Add more screenshots" → duplicates are merged (one row per setting).
7. Free path: with Paddle sandbox on, a Free account sees the `Pro` badge, the upsell in the dialog, and `curl` with that account's cookie gets `403` from the route.
8. `select count(*), sum(input_tokens), sum(output_tokens) from ai_requests;` in `docker exec -it settings_saver-db-1 psql -U gsv gsv` shows the rows.
9. Unset `AI_VISION_PROVIDER`, restart dev: the menu item is gone.

- [ ] **Step 5: Commit docs and open the PR**

```bash
git add docs/architecture/ai-providers.md docs/self-hosting.md README.md
git commit -m "docs: AI screenshot importer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin feat/ai-screenshot-importer
gh pr create --base main --title "feat(ai): screenshot importer (Pro)" --body "$(cat <<'EOF'
## Summary
- Preset page → "Import from screenshot…": upload 1–5 screenshots of the game's settings menu, review every proposed value next to the current one, apply what you tick.
- Anthropic vision provider (`claude-opus-5`, structured outputs, effort low) behind `AI_VISION_PROVIDER=anthropic`; hidden when unset.
- Pro only: `LIMITS.pro.aiScreenshots = 30` images per rolling 24 h, counted in the new `ai_requests` table (migration 0004).
- Values are matched to the preset's own settings by name and coerced to their types; unknown names can be created as new settings. Every write goes through the existing validated paths and records a revision.

## Test plan
- [ ] `pnpm check`
- [ ] Manual: CS2 Video settings screenshot → review → apply → revision "Imported from screenshot"
- [ ] Free account: Pro badge, upsell, route returns 403
- [ ] `AI_VISION_PROVIDER` unset → menu item absent

Spec: docs/superpowers/specs/2026-09-18-ai-screenshot-importer-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Do not merge; Miguel reviews the diff on GitHub.
