import { describe, expect, it } from "vitest";
import {
  buildHints,
  knownSettings,
  matchProposals,
  mergeRows,
  type KnownSettings,
  type ScreenshotRow,
} from "@/lib/ai/screenshot";
import { getCatalogGame } from "@/lib/catalog";
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
  ref: null,
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
    source: "screen",
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

const known: KnownSettings = {
  aliases: new Map([["resolution", ["Screen Resolution"]]]),
  menu: [
    { category: "Video", name: "Display", type: "text" },
    { category: "Video", name: "Resolution", type: "resolution" }, // the preset has it: no m ref
    {
      category: "Music",
      name: "Main Menu Volume",
      type: "slider",
      min: 0,
      max: 100,
      unit: "%",
      aliases: ["Menu Music Volume"],
    },
  ],
};

describe("buildHints", () => {
  it("gives preset settings t refs with their aliases and the rest of the menu m refs", () => {
    const hints = buildHints(
      { name: "CS2" },
      [
        cat("c", "Video", [
          setting("s", "Resolution", "resolution"),
          setting("t", "Texture quality", "enum", {
            options: [
              { label: "Low", value: "low" },
              { label: "High", value: "high" },
            ],
          }),
        ]),
      ],
      known,
    );
    expect(hints).toEqual({
      gameName: "CS2",
      tracked: [
        {
          ref: "t1",
          category: "Video",
          name: "Resolution",
          type: "resolution",
          options: undefined,
          unit: null,
          aliases: ["Screen Resolution"],
        },
        {
          ref: "t2",
          category: "Video",
          name: "Texture quality",
          type: "enum",
          options: ["Low", "High"],
          unit: null,
          aliases: undefined,
        },
      ],
      menu: [
        expect.objectContaining({ ref: "m1", name: "Display", category: "Video" }),
        expect.objectContaining({
          ref: "m2",
          name: "Main Menu Volume",
          category: "Music",
          unit: "%",
          aliases: ["Menu Music Volume"],
        }),
      ],
    });
  });
});

describe("matchProposals with refs and the catalog menu", () => {
  it("trusts the ref over the label, so a renamed setting still lands on its row", () => {
    const rows = matchProposals(
      [proposal({ ref: "t2", name: "Wait for Vertical Sync", rawValue: "Enabled" })],
      categories,
      known,
    );
    expect(rows).toEqual([
      expect.objectContaining({ settingId: "s2", source: "preset", value: true }),
    ]);
  });

  it("keeps Display and Display Mode apart when both claim one ref", () => {
    const withMode = [
      cat("c1", "Video", [
        setting("s1", "Display Mode", "dropdown", {
          options: [
            { label: "Fullscreen", value: "Fullscreen" },
            { label: "Windowed", value: "Windowed" },
          ],
        }),
      ]),
    ];
    const rows = matchProposals(
      [
        proposal({ ref: "t1", name: "Display", rawValue: "Monitor 1", confidence: 0.99 }),
        proposal({ ref: "t1", name: "Display Mode", rawValue: "Fullscreen", confidence: 0.6 }),
      ],
      withMode,
      known,
    );
    expect(rows).toEqual([
      expect.objectContaining({ settingId: "s1", rawValue: "Fullscreen", value: "Fullscreen" }),
      expect.objectContaining({
        settingId: null,
        source: "menu",
        name: "Display",
        value: "Monitor 1",
      }),
    ]);
  });

  it("creates menu settings with the catalog's definition and category", () => {
    const [row] = matchProposals(
      [proposal({ ref: "m2", name: "Main Menu Volume", rawValue: "20%", category: "Audio" })],
      categories,
      known,
    );
    expect(row).toMatchObject({
      settingId: null,
      source: "menu",
      category: "Music",
      def: { type: "slider", min: 0, max: 100, unit: "%" },
      value: 20,
    });
  });

  it("falls back to names and aliases when the ref is missing or unknown", () => {
    const rows = matchProposals(
      [
        proposal({ ref: "t99", name: "Screen Resolution", rawValue: "1280x960" }),
        proposal({ name: "menu music volume", rawValue: "40%" }),
        proposal({ name: "Blur Background", rawValue: "Yes", type: "boolean", category: "Radar" }),
      ],
      categories,
      known,
    );
    expect(rows).toEqual([
      expect.objectContaining({ settingId: "s1", value: { width: 1280, height: 960 } }),
      expect.objectContaining({ source: "menu", name: "Main Menu Volume", value: 40 }),
      expect.objectContaining({ source: "screen", name: "Blur Background", category: "Radar" }),
    ]);
  });
});

describe("knownSettings", () => {
  it("collects cs2's menu and the aliases of its preset settings", () => {
    const cs2 = knownSettings(getCatalogGame("cs2"));
    expect(cs2.aliases.get("waitforverticalsync")).toContain("V-Sync");
    expect(cs2.menu.some((m) => m.name === "Boost Player Contrast")).toBe(true);
    expect(knownSettings(null).menu).toEqual([]);
  });
});
