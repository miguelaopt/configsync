import { describe, expect, it } from "vitest";
import { CATALOG, catalogToExportFile, getCatalogGame } from "@/lib/catalog";
import { exportFileSchema } from "@/lib/import-export/schema";

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
});
