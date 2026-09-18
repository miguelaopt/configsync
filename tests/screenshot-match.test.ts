import { describe, expect, it } from "vitest";
import { buildHints, matchProposals, mergeRows, type ScreenshotRow } from "@/lib/ai/screenshot";
import type { CategoryWithSettings } from "@/lib/data/presets";
import type { ProposedSetting } from "@/lib/providers/screenshot";

type S = CategoryWithSettings["settings"][number];
const setting = (id: string, name: string, type: S["type"], extra: Partial<S> = {}) =>
  ({
    id,
    name,
    type,
    value: null,
    options: null,
    min: null,
    max: null,
    step: null,
    unit: null,
    ...extra,
  }) as S;
const cat = (id: string, name: string, settings: S[]) =>
  ({ id, name, settings }) as CategoryWithSettings;

const categories = [
  cat("c1", "Video", [
    setting("s1", "Resolution", "resolution"),
    setting("s2", "V-Sync", "boolean", { value: false }),
    setting("s3", "Brightness", "slider", { min: 0, max: 100 }),
  ]),
  cat("c2", "Audio", [setting("s4", "Brightness", "percentage")]),
];
const proposal = (over: Partial<ProposedSetting>): ProposedSetting => ({
  name: "",
  rawValue: "",
  category: null,
  type: null,
  confidence: 0.9,
  ...over,
});

describe("matchProposals", () => {
  it("matches by normalised name, coerces to the setting's type and keeps preset order", () => {
    const rows = matchProposals(
      [
        proposal({ name: "v sync", rawValue: "On" }),
        proposal({ name: "RESOLUTION", rawValue: "2560×1440" }),
      ],
      categories,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        settingId: "s1",
        name: "Resolution",
        value: { width: 2560, height: 1440 },
        def: expect.objectContaining({ type: "resolution" }),
        current: null,
      }),
      expect.objectContaining({ settingId: "s2", value: true, current: false }),
    ]);
  });

  it("breaks name ties with the category heading and falls back to the first setting", () => {
    expect(
      matchProposals(
        [proposal({ name: "Brightness", category: "audio", rawValue: "50" })],
        categories,
      )[0]!.settingId,
    ).toBe("s4");
    expect(
      matchProposals([proposal({ name: "Brightness", rawValue: "50" })], categories)[0]!.settingId,
    ).toBe("s3");
  });

  it("keeps unreadable values as null with the raw text, and unknown names as new rows", () => {
    const rows = matchProposals(
      [
        proposal({ name: "V-Sync", rawValue: "Adaptive" }),
        proposal({ name: "Motion Blur", rawValue: "Off", type: "boolean", category: "Video" }),
      ],
      categories,
    );
    expect(rows[0]).toMatchObject({ settingId: "s2", value: null, rawValue: "Adaptive" });
    expect(rows[1]).toMatchObject({
      settingId: null,
      name: "Motion Blur",
      def: { type: "boolean" },
      value: false,
      category: "Video",
      current: null,
    });
  });

  it("clamps confidence, dedupes repeated rows and defaults unknown rows to text", () => {
    const rows = matchProposals(
      [
        proposal({ name: "Crosshair", rawValue: "Dynamic", confidence: 7 }),
        proposal({ name: "V-Sync", rawValue: "Off", confidence: 0.3 }),
        proposal({ name: "V-Sync", rawValue: "On", confidence: 0.8 }),
      ],
      categories,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ settingId: "s2", value: true, confidence: 0.8 });
    expect(rows[1]).toMatchObject({ confidence: 1, def: { type: "text" }, value: "Dynamic" });
  });
});

describe("mergeRows", () => {
  const row = (over: Partial<ScreenshotRow>): ScreenshotRow => ({
    name: "x",
    category: null,
    confidence: 0.5,
    rawValue: "",
    settingId: null,
    def: { type: "text" },
    current: null,
    value: "",
    ...over,
  });
  it("keeps the most confident duplicate across images and lists matched rows first", () => {
    const merged = mergeRows([
      [row({ name: "New thing" }), row({ settingId: "s1", value: 1, confidence: 0.4 })],
      [
        row({ settingId: "s1", value: 2, confidence: 0.9 }),
        row({ name: "new  THING", confidence: 0.2 }),
      ],
    ]);
    expect(merged).toEqual([
      expect.objectContaining({ settingId: "s1", value: 2 }),
      expect.objectContaining({ name: "New thing", confidence: 0.5 }),
    ]);
  });
});

describe("buildHints", () => {
  it("lists option labels and units per setting", () => {
    const hints = buildHints({ name: "CS2" }, [
      cat("c", "Video", [
        setting("s", "Texture quality", "enum", {
          options: [
            { label: "Low", value: "low" },
            { label: "High", value: "high" },
          ],
        }),
        setting("t", "FPS cap", "integer", { unit: "fps" }),
      ]),
    ]);
    expect(hints).toEqual({
      gameName: "CS2",
      categories: [
        {
          name: "Video",
          settings: [
            { name: "Texture quality", type: "enum", options: ["Low", "High"], unit: null },
            { name: "FPS cap", type: "integer", options: undefined, unit: "fps" },
          ],
        },
      ],
    });
  });
});
