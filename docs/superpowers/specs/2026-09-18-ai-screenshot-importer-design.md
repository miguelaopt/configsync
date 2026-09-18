# AI screenshot importer — design

**Status:** approved 2026-09-18 · **Builds on:** `main` after PR #4

## Goal

A Pro user opens a preset, uploads screenshots of the game's settings menu, and gets every
visible setting proposed next to its current value. They tick what to apply, fix anything the
model misread, and save. Nothing is written without confirmation. Without a configured provider
the feature does not appear (self-hosting keeps working).

## Product decisions

| Decision     | Choice                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| Entry point  | Preset page → actions menu → "Import from screenshot…". Proposals are matched to the preset's own settings. |
| Plan         | Pro only, via `limitsFor(plan).aiScreenshots` (`free: 0`, `pro: 30` images per rolling 24 h).               |
| Provider     | Anthropic (`@anthropic-ai/sdk`), model `claude-opus-5` by default, structured outputs, effort `low`.        |
| Images       | 1–5 per run, PNG/JPEG/WebP. Client downsizes to ≤ 1568 px long edge WebP; server caps at 2 MB, sniffed.     |
| Persistence  | The image is not stored. One `ai_requests` row per image (user, tokens, model) for the cap and cost view.   |
| Matching     | By normalised name against the preset's settings. Unmatched proposals can be created as new settings.       |
| Privacy      | Dialog states that the image is sent to Anthropic for analysis and not kept.                                |
| Out of scope | Offline OCR, attaching the screenshot to the preset, a Screenshot tab on `/import`, fuzzy matching.         |

## A. Configuration

`lib/env.ts` gains:

```ts
AI_VISION_PROVIDER: z.enum(["anthropic"]).optional(),
AI_VISION_API_KEY: z.string().optional(),
AI_VISION_MODEL: z.string().default("claude-opus-5"),
```

plus the `|| undefined` normalisation for the two optional ones and a refine: provider set without a
key ⇒ "AI_VISION_API_KEY is required when AI_VISION_PROVIDER is set".
`export const screenshotAssistantEnabled = Boolean(env.AI_VISION_PROVIDER)` moves here (it is the
only place reading `process.env`). `.env.example` uncomments the block and documents the three
variables; `docs/architecture/ai-providers.md` and `docs/self-hosting.md` mention `anthropic` as the
shipped provider and the daily limit.

## B. Provider contract (`lib/providers/screenshot.ts`)

Simplified to what ships. One interface, one implementation:

```ts
export type ScreenshotImage = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

export type ScreenshotHints = {
  gameName: string;
  categories: {
    name: string;
    settings: { name: string; type: SettingTypeId; options?: string[]; unit?: string | null }[];
  }[];
};

/** What the model read. Values are the on-screen text; the core coerces them to setting types. */
export type ProposedSetting = {
  name: string; // exact existing name when the label matches one, else the on-screen label
  rawValue: string; // "On", "1920x1080", "0.85", "High", "Mouse 4", …
  category: string | null; // heading seen on screen
  type: SettingTypeId | null; // guess, only meaningful for names not in the hints
  confidence: number; // 0–1, clamped server-side
};

export interface ScreenshotParser {
  readonly id: string;
  parse(
    image: ScreenshotImage,
    hints: ScreenshotHints,
  ): Promise<{
    proposals: ProposedSetting[];
    usage: { inputTokens: number; outputTokens: number; model: string };
  }>;
}

export function getScreenshotParser(): ScreenshotParser | null; // switch on env.AI_VISION_PROVIDER
```

`OCRProvider` and `VisionProvider` are removed (never implemented, never imported). The doc says
"implement `ScreenshotParser` and add a case".

`lib/providers/anthropic-vision.ts` (server-only):

- `createAnthropicParser(client, model)` takes the SDK client and model so tests can pass a fake;
  `getScreenshotParser()` builds `new Anthropic({ apiKey: env.AI_VISION_API_KEY, timeout: 60_000, maxRetries: 1 })`
  once and memoises the parser. The provider file itself never imports `env`.
- `client.messages.parse({ model: env.AI_VISION_MODEL, max_tokens: 8000, output_config: { effort: "low", format: zodOutputFormat(outputSchema) }, system, messages: [{ role: "user", content: [image block (base64), text block] }] })`.
- `outputSchema = z.object({ settings: z.array(z.object({ name: z.string(), value: z.string(), category: z.string().nullable(), type: z.enum(SETTING_TYPE_IDS).nullable(), confidence: z.number() })) })` — plain types only (the structured-output JSON-schema subset); clamp confidence to [0, 1] after parsing.
- System prompt (static): reads screenshots of video-game settings menus; lists only settings whose current value is visible; uses the exact name from the provided list when the on-screen label is that setting (synonyms and abbreviations count), otherwise the on-screen label; copies values as displayed (do not convert units or invent precision); skips rows that are cut off or unreadable; `type` only for names not in the list; confidence reflects legibility and name certainty.
- User text block: game name, then the hint list rendered as `Category › Setting name (type; options: a | b | c; unit)`, one per line.
- `stop_reason === "refusal"` or `parsed_output == null` ⇒ `proposals: []` (the route turns that into "No settings found").
- Errors: `Anthropic.AuthenticationError` ⇒ `AppError("The AI provider rejected the server's API key. Ask the administrator to check AI_VISION_API_KEY.")`; `Anthropic.RateLimitError` ⇒ `AppError("The AI provider is busy. Try again in a minute.")`; other `Anthropic.APIError` ⇒ `AppError("The AI provider returned an error. Try again.")`; anything else propagates (logged by the route).

## C. Core: match and coerce (`lib/ai/screenshot.ts`, pure, tested)

```ts
export type ScreenshotRow = {
  name: string;
  category: string | null;
  confidence: number;
  rawValue: string;
  /** Existing setting this row updates, or null when it would be created. */
  settingId: string | null;
  /** Matched: the setting's own definition (type, min, max, step, options, unit). New: `{ type: guess ?? "text" }`. */
  def: SettingDefinition;
  /** Matched only — the value stored today, for side-by-side review. */
  current: SettingValue | null;
  value: SettingValue | null; // coerced and valid for `def`; null when unreadable
};

export function buildHints(
  game: { name: string },
  categories: CategoryWithSettings[],
): ScreenshotHints;
export function matchProposals(
  proposals: ProposedSetting[],
  categories: CategoryWithSettings[],
): ScreenshotRow[];
/** Rows from several images: same settingId keeps the higher confidence; unmatched rows dedupe by normalised name. */
export function mergeRows(batches: ScreenshotRow[][]): ScreenshotRow[];
```

The module has no runtime server imports (`CategoryWithSettings` is a type import), so
`mergeRows` also runs in the browser.

- `normalise = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")`. Existing settings are indexed
  by normalised name; when two settings share a name, the one whose category normalises to the
  proposal's `category` wins, else the first.
- Duplicate proposals for the same `settingId` (overlapping screenshots) keep the higher confidence.
- Rows are ordered as in the preset (category position, setting position); unmatched rows follow
  in the order the model returned them.
- Matched rows use the setting's own definition for coercion; unmatched rows use `{ type: guess ?? "text" }`.
- `matchProposals` ends by running its rows through `mergeRows`, so a model that repeats a row is deduped server-side too.

`lib/settings/coerce.ts` — `coerceValue(def: SettingDefinition, raw: string): SettingValue | null`,
then validated with `valueSchemaFor(def)`; invalid ⇒ `null`:

| Type                                               | Rule                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| boolean                                            | on/off, yes/no, true/false, enabled/disabled, 1/0 (case-insensitive); else null                                                                     |
| integer, decimal, slider, percentage               | first number in the string (strip `%`, units, spaces; exactly one `,` and no `.` ⇒ `,` is the decimal separator); integer type rejects non-integers |
| dropdown, enum                                     | option whose label or value equals the raw text case-insensitively; no options defined ⇒ raw text; no match ⇒ null                                  |
| multi_select                                       | split on `,`, each part as above; any miss ⇒ null                                                                                                   |
| resolution                                         | `/(\d{3,5})\s*[x×*]\s*(\d{3,5})/` ⇒ `{ width, height }`                                                                                             |
| color                                              | hex with or without `#`, normalised to `#rrggbb`; else null                                                                                         |
| text, long_text, keybind, controller_binding, info | trimmed raw text                                                                                                                                    |

## D. Data

`lib/billing/limits.ts`: `LIMITS` gains `aiScreenshots: { free: 0, pro: 30 }` and
`AI_LIMIT_MESSAGE = "Screenshot import is a Pro feature — upgrade to Pro to use it."` (contains "upgrade to Pro" so `toastError` adds its "See plans" action) / `AI_DAILY_MESSAGE = "You've analysed 30 screenshots in the last 24 hours. Try again later."`.

`lib/db/schema.ts`: table `ai_requests` — `id uuid pk`, `user_id` (fk users, cascade),
`model text`, `input_tokens int`, `output_tokens int`, `created_at timestamptz default now()`,
index on `(user_id, created_at)`. Migration `0004_ai_requests`.

`lib/data/ai.ts` (server-only):

- `assertCanAnalyse(userId)` — `getPlan` → limit; `0` ⇒ `AppError(AI_LIMIT_MESSAGE, "forbidden")`;
  else count rows in the last 24 h ⇒ `AppError(AI_DAILY_MESSAGE, "forbidden")` at the cap.
- `analyseScreenshot(userId, presetId, image)` — `getScreenshotParser()` (null ⇒ `AppError("Screenshot import isn't configured on this server.")`);
  `assertCanAnalyse`; `getPresetFull` (ownership) and the game name; `parse(image, buildHints(...))`;
  inserts one `ai_requests` row from `usage`; returns `{ rows: matchProposals(...) }`.
  The cap is checked before the call and the row written after; a burst can overshoot by a few
  images — acceptable (`ponytail:` comment, upgrade path = reserve the row first).
- `applyScreenshotRows(userId, presetId, updates, creates)` — refuses a `categoryId` that is not in
  this preset; then `updateSettingValues` (validates every value), `createSetting` for each create,
  then `createRevision(userId, presetId, "Imported from screenshot")`.
  Runs inside one `db.transaction`: `updateSettingValues`, `createSetting`, `getCategory` and
  `nextPosition` take an optional `tx` (default `db`), the same pattern as `getPresetById`.

## E. Route and action

`app/api/ai/screenshot/route.ts` — `POST ?preset=<id>`, raw image body (same shape as the cover
upload route): session required; `content-length` and body ≤ 2 MB else 413; `detectImageType`
must return png/jpeg/webp else 400; `analyseScreenshot`; `AppError` ⇒ 400 with the message
(403 when `kind === "forbidden"`); other errors logged as `[csync:ai]` ⇒ 500. Response:
`{ rows: ScreenshotRow[] }`. One image per request; the client runs up to 5 in parallel and
merges the results with `mergeRows`. Because each row carries `def` and `current`, the dialog only
needs the preset's category list (`{ id, name }[]`) from the page, not the full settings.

`lib/actions/ai.ts` — `applyScreenshotAction({ presetId, updates: settingValueUpdateSchema[] (max 1000), creates: { categoryId, name, type, value }[] (max 200) })`
→ `applyScreenshotRows`; `revalidatePath("/", "layout")`; returns `{ updated, created }`.
At least one of the two arrays must be non-empty.

## F. UI

Preset page passes `ai={{ enabled: screenshotAssistantEnabled, plan }}` through `PresetHeader` to
`PresetActionsMenu`. When `enabled`, the menu shows "Import from screenshot…" (`ScanText` icon)
after "Game config files…"; Free users see a `Pro` badge on the item.

`components/presets/screenshot-dialog.tsx` (client), states:

1. **upsell** (Free): one paragraph + "See Pro" link to `/pricing`.
2. **pick**: privacy line ("Screenshots are sent to Anthropic to read the settings. They are analysed once and not stored."),
   `Input type="file" multiple accept="image/png,image/jpeg,image/webp"` (max 5, toast beyond),
   thumbnails of the chosen files, "Analyse" button. Before upload each file is drawn on a canvas
   scaled to ≤ 1568 px long edge and exported as `image/webp` at 0.85 (falls back to the original
   file when the canvas export fails).
3. **analysing**: spinner and "Reading N screenshot(s)…"; failures toast per image; if every
   image fails the dialog returns to _pick_.
4. **review**: two sections.
   - _Matched_ rows: checkbox · setting name (category muted) · "Now: <formatValue(current)>" ·
     `SettingControl layout="row"` bound to the editable proposed value · confidence badge
     (`< 0.5` ⇒ `Badge variant="note"` "Check"). Pre-checked when `value != null`, confidence ≥ 0.5 and
     the value differs from the current one. `value == null` ⇒ the control is empty and the row shows
     "Read as “<rawValue>”" so the user can pick the value by hand.
   - _Not in this preset_: checkbox (off) · name `Input` · type `Select` (from `SETTING_TYPES`) · category
     `Select` (the preset's categories; when there are none the section says "Add a category first"
     and stays disabled) · `SettingControl` for the value.
   - Footer: "Apply N change(s)" (disabled at 0) and "Add more screenshots" (back to _pick_, keeping rows).
5. Apply ⇒ `applyScreenshotAction`; success ⇒ toast "Applied N settings from your screenshots",
   `router.refresh()`, close.

`lib/billing/public.ts`: "AI screenshot importer (coming soon)" → "AI screenshot importer (30 screenshots a day)".

## Errors and safety

- The route never trusts the client's MIME type; magic bytes decide, like covers.
- Every value written goes through `updateSettingValues`/`createSetting`, which validate against
  the setting definition — the AI path cannot store an out-of-range or unknown-option value.
- Model output is data: names are matched, never used as ids; `category`/`name` render as text.
- The API key lives in `env` (server-only); the client only ever sees `rows`.
- No request is billed without a Pro plan; the cap protects the operator's API budget.
- Free users cannot reach the route (403) even if they open the dialog by hand.

## Tests

- `tests/coerce.test.ts` — one case per type row of the table above, including rejections.
- `tests/screenshot-match.test.ts` — exact and normalised matches, category tie-break, dedupe by
  confidence, ordering, unmatched rows with and without a type guess, `buildHints` shape.
- `tests/billing.test.ts` — `limitsFor("free").aiScreenshots === 0`.
- `tests/anthropic-vision.test.ts` — fake `messages.parse`: request carries the image and hint lines, output is mapped and clamped, refusal ⇒ no proposals, 401/429 become `AppError`s.
- Manual: set `AI_VISION_PROVIDER=anthropic` and `AI_VISION_API_KEY` in `.env`, open the CS2 Default
  preset, upload a screenshot of CS2's Video settings, check the matched values, apply, confirm the
  revision "Imported from screenshot" exists and a Free account gets the upsell and a 403.
