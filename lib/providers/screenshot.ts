/**
 * Screenshot assistant — provider contracts.
 *
 * The core app never depends on these. A future "import from screenshot" flow:
 *   1. user uploads an image
 *   2. a ScreenshotParser proposes settings (via OCR and/or a vision model)
 *   3. the user reviews and corrects every proposal
 *   4. only confirmed values are saved — nothing is written without confirmation
 *
 * Providers are selected by AI_VISION_PROVIDER at runtime; none ships today.
 * See docs/architecture/ai-providers.md.
 */
import type { SettingTypeId, SettingValue } from "@/lib/settings/types";

export type ScreenshotImage = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

/** One proposed setting. Always shown to the user as a suggestion, never auto-applied. */
export type ProposedSetting = {
  name: string;
  value: SettingValue;
  /** Best-effort guess; the review UI lets the user change it. */
  type?: SettingTypeId;
  /** 0–1. Below ~0.5 the UI should visibly flag the row. */
  confidence: number;
  /** Which category the provider thinks this belongs to (a heading it saw on screen). */
  category?: string;
};

/** Plain text extraction — e.g. Tesseract. Cheap, offline-capable. */
export interface OCRProvider {
  readonly id: string;
  extractText(image: ScreenshotImage): Promise<string>;
}

/** Multimodal model that reads the image directly and returns structured proposals. */
export interface VisionProvider {
  readonly id: string;
  proposeSettings(
    image: ScreenshotImage,
    hints?: { gameName?: string; categoryNames?: string[] },
  ): Promise<ProposedSetting[]>;
}

/** What the import flow talks to. Wraps an OCRProvider, a VisionProvider, or both. */
export interface ScreenshotParser {
  readonly id: string;
  parse(
    image: ScreenshotImage,
    hints?: { gameName?: string; categoryNames?: string[] },
  ): Promise<ProposedSetting[]>;
}

/** Whether the UI should offer the screenshot assistant at all. */
export const screenshotAssistantEnabled = Boolean(process.env.AI_VISION_PROVIDER);

/**
 * Resolves the configured parser. Returns null when AI is not configured so the
 * caller can hide the feature instead of failing.
 */
export function getScreenshotParser(): ScreenshotParser | null {
  // ponytail: no providers exist yet. Add a switch on AI_VISION_PROVIDER when the first one lands.
  return null;
}
