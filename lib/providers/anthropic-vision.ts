import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AppError } from "@/lib/data/errors";
import { SETTING_TYPE_IDS } from "@/lib/settings/types";
import type { ScreenshotHints, ScreenshotParser } from "./screenshot";

// No `env` import here: getScreenshotParser() injects the client so tests can pass a fake.

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
type Output = z.infer<typeof outputSchema>;

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
      const parsed =
        response.stop_reason === "refusal" ? null : (response.parsed_output as Output | null);
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
