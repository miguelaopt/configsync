import { describe, expect, it } from "vitest";
import { parseImportFile, summarizeFile } from "@/lib/import-export/parse";
import { buildExportFile, toCsv, toJson, toMarkdown } from "@/lib/import-export/serialize";
import type { GameDoc } from "@/lib/import-export/schema";

const game: GameDoc = {
  name: "Skyline Drift",
  platforms: ["PC"],
  tags: ["racing"],
  notes: null,
  presets: [
    {
      name: "Main Setup",
      tags: [],
      isDefault: true,
      description: "Daily driver",
      notes: "Feels good, don't touch",
      categories: [
        {
          name: "Controls",
          settings: [
            { name: "Sensitivity", type: "integer", value: 8, min: 1, max: 20 },
            { name: "Vibration", type: "boolean", value: false },
            { name: "Aim Assist", type: "boolean", value: true },
          ],
        },
        {
          name: "Display",
          settings: [
            { name: "Resolution", type: "resolution", value: { width: 1920, height: 1080 } },
            { name: "Brightness", type: "percentage", value: 100 },
            { name: "Motion Blur, \"Cinematic\"", type: "enum", value: "off", options: [{ label: "Off", value: "off" }, { label: "Low", value: "low" }] },
          ],
        },
      ],
    },
  ],
};

describe("export → import round trip", () => {
  it("parses its own JSON output without loss", () => {
    const json = toJson(buildExportFile([game], "game"));
    const result = parseImportFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.games[0]?.name).toBe("Skyline Drift");
    expect(result.file.games[0]?.presets[0]?.categories[1]?.settings[0]?.value).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(summarizeFile(result.file)).toEqual({ games: 1, presets: 1, settings: 6 });
    expect(result.warnings).toEqual([]);
  });
});

describe("parseImportFile", () => {
  it("rejects non-JSON with a friendly message", () => {
    const r = parseImportFile("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/valid JSON/);
  });

  it("rejects files from other apps", () => {
    const r = parseImportFile(JSON.stringify({ hello: "world" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/Not a GameSettings Vault file/);
  });

  it("rejects unknown versions instead of guessing", () => {
    const r = parseImportFile(JSON.stringify({ format: "gamesettings-vault", version: 99, games: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/version 99/);
  });

  it("reports structural problems with a path", () => {
    const r = parseImportFile(
      JSON.stringify({ format: "gamesettings-vault", version: 1, games: [{ name: "", presets: [] }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/games\.0\.name/);
  });

  it("rejects values that don't match their type, naming the setting", () => {
    const bad = buildExportFile(
      [
        {
          ...game,
          presets: [
            {
              ...game.presets[0]!,
              categories: [
                { name: "Controls", settings: [{ name: "Sensitivity", type: "integer", value: "eight" }] },
              ],
            },
          ],
        },
      ],
      "game",
    );
    const r = parseImportFile(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/Skyline Drift › Main Setup › Controls › Sensitivity/);
  });

  it("warns (not errors) about empty presets", () => {
    const r = parseImportFile(
      JSON.stringify(buildExportFile([{ ...game, presets: [{ name: "Empty", tags: [], isDefault: false, categories: [] }] }], "game")),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings[0]).toMatch(/no categories/);
  });
});

describe("toMarkdown / toCsv", () => {
  it("renders a readable markdown hierarchy", () => {
    const md = toMarkdown([game]);
    expect(md).toContain("# Skyline Drift");
    expect(md).toContain("## Main Setup (default)");
    expect(md).toContain("### Controls");
    expect(md).toContain("- Sensitivity: 8");
    expect(md).toContain("- Vibration: Off");
    expect(md).toContain("- Resolution: 1920×1080");
    expect(md).toContain("- Brightness: 100%");
    expect(md).toContain("> Feels good");
  });

  it("produces RFC-4180 CSV with quoted cells", () => {
    const csv = toCsv([game]);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("game,preset,category,setting,type,value,unit,notes");
    expect(lines).toHaveLength(7);
    expect(csv).toContain('"Motion Blur, ""Cinematic"""');
  });
});
