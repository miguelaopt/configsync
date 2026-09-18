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
  const parse = vi.fn(async (_params: unknown) => ({
    stop_reason: "end_turn",
    model: "claude-opus-5",
    usage: { input_tokens: 1200, output_tokens: 80 },
    ...response,
  }));
  return { client: { messages: { parse } } as unknown as ParseClient, parse };
};
const throwing = (error: unknown) =>
  ({
    messages: {
      parse: vi.fn(async () => {
        throw error;
      }),
    },
  }) as unknown as ParseClient;

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
    const req = parse.mock.calls[0]![0] as {
      model: string;
      messages: {
        content: { type: string; source?: { data: string; media_type: string }; text?: string }[];
      }[];
    };
    expect(req.model).toBe("claude-opus-5");
    expect(req.messages[0]!.content[0]).toMatchObject({
      type: "image",
      source: { media_type: "image/webp", data: Buffer.from([1, 2, 3]).toString("base64") },
    });
    expect(req.messages[0]!.content[1]!.text).toContain("Video › Resolution");
  });

  it("returns no proposals on refusal or unparsable output", async () => {
    const refused = clientWith({ stop_reason: "refusal", parsed_output: null }).client;
    expect((await createAnthropicParser(refused, "m").parse(image, hints)).proposals).toEqual([]);
    const broken = clientWith({ parsed_output: null }).client;
    expect((await createAnthropicParser(broken, "m").parse(image, hints)).proposals).toEqual([]);
  });

  it("turns SDK errors into user-safe messages", async () => {
    const auth = Anthropic.APIError.generate(
      401,
      { error: { message: "bad key" } },
      "bad key",
      new Headers(),
    );
    await expect(createAnthropicParser(throwing(auth), "m").parse(image, hints)).rejects.toMatchObject({
      name: "AppError",
      message: expect.stringContaining("AI_VISION_API_KEY"),
    });
    const busy = Anthropic.APIError.generate(
      429,
      { error: { message: "slow down" } },
      "slow down",
      new Headers(),
    );
    await expect(createAnthropicParser(throwing(busy), "m").parse(image, hints)).rejects.toMatchObject({
      message: expect.stringContaining("busy"),
    });
  });
});
