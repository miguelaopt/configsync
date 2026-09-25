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
  tracked: [
    { ref: "t1", category: "Video", name: "Resolution", type: "resolution" },
    {
      ref: "t2",
      category: "Video",
      name: "Texture Quality",
      type: "enum",
      options: ["Low", "High"],
    },
    { ref: "t3", category: "Video", name: "FPS cap", type: "integer", unit: "fps" },
    {
      ref: "t4",
      category: "Video",
      name: "Wait for Vertical Sync",
      type: "boolean",
      aliases: ["V-Sync"],
    },
  ],
  menu: [{ ref: "m1", category: "Video", name: "Display", type: "text" }],
};
const image = { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/webp" as const };
const other = { bytes: new Uint8Array([4, 5]), mimeType: "image/png" as const };

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
  it("lists one setting per line with its ref, type, options, unit and other names", () => {
    const text = renderHints(hints);
    expect(text).toContain("Game: Counter-Strike 2");
    expect(text).toContain("t1 · Video › Resolution (resolution)");
    expect(text).toContain("t2 · Video › Texture Quality (enum; options: Low | High)");
    expect(text).toContain("t3 · Video › FPS cap (integer; unit: fps)");
    expect(text).toContain("t4 · Video › Wait for Vertical Sync (boolean; also shown as: V-Sync)");
    expect(text).toMatch(/not in the preset yet:\nm1 · Video › Display \(text\)/);
  });
  it("leaves the menu section out when the catalog has nothing more", () => {
    expect(renderHints({ ...hints, menu: [] })).not.toContain("not in the preset yet");
  });
});

describe("createAnthropicParser", () => {
  it("sends every image in one call with the hints, maps refs and clamps confidence", async () => {
    const { client, parse } = clientWith({
      parsed_output: {
        settings: [
          {
            ref: "t4",
            label: "V-Sync",
            value: "Disabled",
            category: "Video",
            type: null,
            confidence: 0.95,
          },
          {
            ref: null,
            label: "Motion Blur",
            value: "Off",
            category: "Video",
            type: "boolean",
            confidence: 3,
          },
        ],
      },
    });
    const result = await createAnthropicParser(client, "claude-opus-5").parse(
      [image, other],
      hints,
    );
    expect(parse).toHaveBeenCalledTimes(1);
    expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 80, model: "claude-opus-5" });
    expect(result.proposals).toEqual([
      {
        ref: "t4",
        name: "V-Sync",
        rawValue: "Disabled",
        category: "Video",
        type: null,
        confidence: 0.95,
      },
      {
        ref: null,
        name: "Motion Blur",
        rawValue: "Off",
        category: "Video",
        type: "boolean",
        confidence: 1,
      },
    ]);
    const req = parse.mock.calls[0]![0] as {
      model: string;
      messages: {
        content: { type: string; source?: { data: string; media_type: string }; text?: string }[];
      }[];
    };
    expect(req.model).toBe("claude-opus-5");
    const content = req.messages[0]!.content;
    expect(content.map((c) => c.type)).toEqual(["text", "image", "text", "image", "text"]);
    expect(content[0]!.text).toBe("Screenshot 1 of 2:");
    expect(content[1]).toMatchObject({
      source: { media_type: "image/webp", data: Buffer.from([1, 2, 3]).toString("base64") },
    });
    expect(content[3]).toMatchObject({ source: { media_type: "image/png" } });
    expect(content[4]!.text).toContain("t1 · Video › Resolution");
  });

  it("returns no proposals on refusal or unparsable output", async () => {
    const refused = clientWith({ stop_reason: "refusal", parsed_output: null }).client;
    expect((await createAnthropicParser(refused, "m").parse([image], hints)).proposals).toEqual([]);
    const broken = clientWith({ parsed_output: null }).client;
    expect((await createAnthropicParser(broken, "m").parse([image], hints)).proposals).toEqual([]);
  });

  it("turns SDK errors into user-safe messages", async () => {
    const auth = Anthropic.APIError.generate(
      401,
      { error: { message: "bad key" } },
      "bad key",
      new Headers(),
    );
    await expect(
      createAnthropicParser(throwing(auth), "m").parse([image], hints),
    ).rejects.toMatchObject({
      name: "AppError",
      message: expect.stringContaining("AI_VISION_API_KEY"),
    });
    const busy = Anthropic.APIError.generate(
      429,
      { error: { message: "slow down" } },
      "slow down",
      new Headers(),
    );
    await expect(
      createAnthropicParser(throwing(busy), "m").parse([image], hints),
    ).rejects.toMatchObject({
      message: expect.stringContaining("busy"),
    });
  });
});
