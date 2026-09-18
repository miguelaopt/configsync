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
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { SettingTypeId } from "@/lib/settings/types";
import { createAnthropicParser } from "./anthropic-vision";

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
