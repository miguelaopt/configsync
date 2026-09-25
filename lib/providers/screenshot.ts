/**
 * Screenshot importer — provider contract.
 *
 * Flow: the user uploads screenshots of a settings menu → the parser reads them together and
 * returns each setting it saw, pointing at the preset setting (or catalog menu entry) it is by
 * ref → lib/ai/screenshot.ts resolves the refs and coerces the values → the user reviews every
 * row → only rows the user confirms are saved.
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

/** One setting the model may point at: `t…` is in the preset, `m…` is only in the game's menu. */
export type HintSetting = {
  ref: string;
  category: string;
  name: string;
  type: SettingTypeId;
  options?: string[];
  unit?: string | null;
  aliases?: string[];
};

/** What the model is told so it can match what it reads to settings that already exist. */
export type ScreenshotHints = { gameName: string; tracked: HintSetting[]; menu: HintSetting[] };

/** One thing the model read. Values are on-screen text; the core coerces them to setting types. */
export type ProposedSetting = {
  /** The hint this row is, or null when it is none of them. */
  ref: string | null;
  /** The label as written on screen. */
  name: string;
  /** "On", "1920x1080", "0.85", "High", "Mouse 4", … */
  rawValue: string;
  /** For unmatched rows: the hint category it belongs in, else the on-screen tab or heading. */
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
  /** All screenshots of one menu go in one call, so headings and context carry across them. */
  parse(images: ScreenshotImage[], hints: ScreenshotHints): Promise<ParseResult>;
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
        new Anthropic({ apiKey: env.AI_VISION_API_KEY, timeout: 180_000, maxRetries: 1 }),
        env.AI_VISION_MODEL,
      );
      break;
    default:
      parser = null;
  }
  return parser;
}
