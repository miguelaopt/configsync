import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AppError } from "@/lib/data/errors";
import { SETTING_TYPE_IDS } from "@/lib/settings/types";
import type { HintSetting, ScreenshotHints, ScreenshotParser } from "./screenshot";

// No `env` import here: getScreenshotParser() injects the client so tests can pass a fake.

const outputSchema = z.object({
  settings: z.array(
    z.object({
      ref: z.string().nullable(),
      label: z.string(),
      value: z.string(),
      category: z.string().nullable(),
      type: z.enum(SETTING_TYPE_IDS).nullable(),
      confidence: z.number(),
    }),
  ),
});
type Output = z.infer<typeof outputSchema>;

const SYSTEM = `You read screenshots of one video game's settings menu and transcribe every setting shown. The screenshots are consecutive parts of the same menu: a heading on one screenshot still applies to the rows at the top of the next, and a row that appears on two screenshots is one setting.

You also receive the settings this game is known to have, each with a ref:
- "t…" refs are settings already in the user's preset.
- "m…" refs are settings from the game's menu that the preset does not have yet.

For every row on screen:
- "label" is the setting's name exactly as written on screen.
- "ref" is the known setting this row IS, decided by meaning, not by spelling. Games rename and abbreviate labels between versions ("V-Sync" is "Wait for Vertical Sync"; "Enable Developer Console" is "Launched With Developer Console"), so use the category, the value and its options, and the "also shown as" names. A label that merely contains another setting's name is a different setting: "Display" (which monitor) is not "Display Mode" (fullscreen or windowed). Prefer a "t" ref over an "m" ref for the same setting. Never give two rows the same ref. Use null when the row is none of the known settings.
- "value" is the current value exactly as displayed ("On", "1920x1080", "0.85", "High", "Mouse 4"), without markers the game adds around it, such as a leading "*". Never convert units or add precision.
- "category": for a row with a ref, use that setting's category. For a row with no ref, use the known category it fits best (a row under an "Advanced Video" or "Frame Pacing" heading on the Video tab belongs in "Video"); only when none fits, use the on-screen tab or heading.
- "type" is your best guess for rows with no ref, else null.
- "confidence" (0–1) reflects how legible the value is and how sure you are of the ref.

Include only settings whose current value is visible. Skip buttons, links such as "Go to key binding", explanatory text and rows that are cut off or unreadable.`;

/** The slice of the SDK client the parser uses; tests pass a fake. */
export type ParseClient = { messages: { parse: Anthropic["messages"]["parse"] } };

export function createAnthropicParser(client: ParseClient, model: string): ScreenshotParser {
  return {
    id: "anthropic",
    async parse(images, hints) {
      let response: Awaited<ReturnType<ParseClient["messages"]["parse"]>>;
      try {
        response = await client.messages.parse({
          model,
          max_tokens: 16_000,
          system: SYSTEM,
          output_config: { effort: "medium", format: zodOutputFormat(outputSchema) },
          messages: [
            {
              role: "user",
              content: [
                ...images.flatMap((image, i) => [
                  { type: "text" as const, text: `Screenshot ${i + 1} of ${images.length}:` },
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: image.mimeType,
                      data: Buffer.from(image.bytes).toString("base64"),
                    },
                  },
                ]),
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
          ref: s.ref,
          name: s.label,
          rawValue: s.value,
          category: s.category,
          type: s.type,
          confidence: Math.min(1, Math.max(0, s.confidence)),
        })),
      };
    },
  };
}

/** `t3 · Video › Setting (type; options: a | b; unit: x; also shown as: y)` — one line each. */
export function renderHints(h: ScreenshotHints): string {
  const line = (s: HintSetting) => {
    const parts = [
      s.type,
      s.options?.length ? `options: ${s.options.join(" | ")}` : null,
      s.unit ? `unit: ${s.unit}` : null,
      s.aliases?.length ? `also shown as: ${s.aliases.join(" / ")}` : null,
    ].filter(Boolean);
    return `${s.ref} · ${s.category} › ${s.name} (${parts.join("; ")})`;
  };
  return [
    `Game: ${h.gameName}`,
    "",
    "Settings in the user's preset:",
    h.tracked.map(line).join("\n") || "(none yet)",
    ...(h.menu.length
      ? [
          "",
          "Other settings in this game's menu, not in the preset yet:",
          h.menu.map(line).join("\n"),
        ]
      : []),
  ].join("\n");
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
