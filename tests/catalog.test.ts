import { describe, expect, it } from "vitest";
import {
  CATALOG,
  catalogToExportFile,
  catalogToGameDoc,
  getCatalogGame,
  type CatalogGame,
} from "@/lib/catalog";
import { exportFileSchema } from "@/lib/import-export/schema";
import { buildExportFile } from "@/lib/import-export/serialize";

describe("catalog", () => {
  it("contains cs2 and rocket-league", () => {
    expect(CATALOG.map((g) => g.id).sort()).toEqual(["cs2", "rocket-league"]);
  });
  it("every source refers to a declared file", () => {
    for (const g of CATALOG) {
      const fileIds = new Set(g.files.map((f) => f.id));
      for (const p of g.presets)
        for (const c of p.categories)
          for (const s of c.settings) {
            if (s.source)
              expect(fileIds.has(s.source.file), `${g.id}/${c.name}/${s.name}`).toBe(true);
          }
    }
  });
  it("converts to a valid export file without catalog-only fields", () => {
    const file = catalogToExportFile(getCatalogGame("cs2")!);
    expect(exportFileSchema.safeParse(file).success).toBe(true);
    expect(file.games[0]!.catalogId).toBe("cs2");
    expect(JSON.stringify(file)).not.toContain('"source"');
  });
  it("strips catalog-only fields from a game that actually has them", () => {
    const game: CatalogGame = {
      id: "test-game",
      name: "Test Game",
      platforms: [],
      tags: [],
      files: [
        {
          id: "video",
          format: "keyvalues",
          bool: "01",
          section: [],
          paths: { "steam-linux": "/x" },
        },
      ],
      presets: [
        {
          name: "Default",
          tags: [],
          isDefault: true,
          categories: [
            {
              name: "Video",
              settings: [
                { name: "Resolution", type: "resolution", source: { file: "video", key: "k" } },
              ],
            },
          ],
        },
      ],
    };
    const doc = catalogToGameDoc(game);
    expect(doc.catalogId).toBe("test-game");
    expect(doc).not.toHaveProperty("files");
    expect(doc).not.toHaveProperty("id");
    expect(doc).not.toHaveProperty("steamAppId");
    expect(doc).not.toHaveProperty("epicAppName");
    expect(doc.presets[0]!.categories[0]!.settings[0]).not.toHaveProperty("source");
    expect(exportFileSchema.safeParse(buildExportFile([doc], "game")).success).toBe(true);
  });
  it("cs2 maps resolution, display mode and a keybind", () => {
    const cs2 = getCatalogGame("cs2")!;
    const all = cs2.presets[0]!.categories.flatMap((c) =>
      c.settings.map((s) => ({ ...s, category: c.name })),
    );
    const res = all.find((s) => s.name === "Resolution")!;
    expect(res.source).toEqual({
      file: "video",
      width: "setting.defaultres",
      height: "setting.defaultresheight",
    });
    expect(all.find((s) => s.name === "Display Mode")!.source).toHaveProperty("match");
    expect(all.find((s) => s.name === "Fire")!.source).toEqual({ file: "keys", bind: "+attack" });
    expect(cs2.files.map((f) => f.id)).toEqual(["video", "convars", "keys"]);
  });
  it("rocket league marks camera settings as manual", () => {
    const rl = getCatalogGame("rocket-league")!;
    const camera = rl.presets[0]!.categories.find((c) => c.name === "Camera")!;
    expect(camera.settings.every((s) => !s.source)).toBe(true);
    expect(rl.files.map((f) => f.id)).toEqual(["video", "input"]);
  });
});
