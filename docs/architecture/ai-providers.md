# AI providers (optional)

The core app works without AI. The one AI feature is the **screenshot importer** (Pro): on a
preset page, upload screenshots of the game's settings menu and get every visible setting
proposed next to its current value. The user reviews each row; nothing is saved without a tick
and an explicit Apply.

## Rules

1. AI output is a suggestion. Every row is reviewed and confirmed before it is written.
2. Proposals are matched to the preset's own settings by name; values are coerced to the
   setting's type and validated like any manual edit. Unknown names can be created as new
   settings, also only on confirmation.
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
