import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildHints, knownSettings, matchProposals } from "@/lib/ai/screenshot";
import { getCatalogGame } from "@/lib/catalog";
import type { CategoryWithSettings } from "@/lib/data/presets";
import { proposalsFromTsv } from "@/lib/providers/tesseract-ocr";

// Tesseract's TSV (psm 11, tessdata_fast eng) of a real Rocket League Video tab.
const tsv = readFileSync(new URL("./fixtures/rl-video.tsv", import.meta.url), "utf8");
const game = getCatalogGame("rocket-league")!;
const known = knownSettings(game);
// The catalog's default preset, as a new Rocket League preset starts.
const categories = game.presets[0]!.categories.map(
  (c, i) =>
    ({
      id: `c${i}`,
      name: c.name,
      settings: c.settings.map((s, j) => ({ ...s, id: `s${i}-${j}`, value: null })),
    }) as unknown as CategoryWithSettings,
);

describe("proposalsFromTsv", () => {
  const proposals = proposalsFromTsv(tsv, buildHints({ name: "Rocket League" }, categories, known));
  const values = Object.fromEntries(proposals.map((p) => [p.name.toLowerCase(), p.rawValue]));

  it("reads the text value after each known label, two columns per line", () => {
    expect(values).toMatchObject({
      resolution: "1920 x 1080 16:9",
      "display mode": "Fullscreen",
      "anti-aliasing": "Off",
      "render quality": "High Quality",
      "texture detail": "Performance",
    });
  });

  it("skips rows with no text value (checkboxes)", () => {
    expect(values).not.toHaveProperty("bloom");
    expect(values).not.toHaveProperty("motion blur");
  });

  it("resolves to catalog settings", () => {
    const rows = matchProposals(proposals, categories, known);
    expect(rows.find((r) => r.name === "Display Mode")?.source).toBe("preset");
  });
});
