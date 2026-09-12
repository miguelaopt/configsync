# AI providers (optional)

The core app works without any AI. The only planned AI feature is a **screenshot assistant**: upload a screenshot of a game's settings screen and get a list of _proposed_ settings to review.

## Rules

1. AI output is a suggestion. The user reviews every row and confirms before anything is saved.
2. AI never overwrites an existing value silently. Conflicts are shown side by side.
3. Detected values are visibly labelled as AI-detected until confirmed.
4. If no provider is configured, the feature is hidden — not broken.

## Contracts

Defined in [`lib/providers/screenshot.ts`](../../lib/providers/screenshot.ts):

- `OCRProvider` — image → text (e.g. Tesseract). Cheap, can run offline.
- `VisionProvider` — image → `ProposedSetting[]` via a multimodal model.
- `ScreenshotParser` — what the import flow calls. Wraps one or both of the above.

`ProposedSetting` carries `name`, `value`, a guessed `type`, a `confidence` (0–1) and the on-screen `category` heading.

## Configuration

```
AI_VISION_PROVIDER=   # empty = disabled
AI_VISION_API_KEY=
```

`getScreenshotParser()` returns `null` when unset. No provider is shipped yet; adding one means implementing an interface above and adding a case to that function. Keys are read server-side only and never sent to the client.

## Privacy

Screenshots sent to a hosted model leave the server. The review UI must say which provider will receive the image before upload, and self-hosters can choose an on-device OCR provider instead.
