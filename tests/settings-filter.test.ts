import { describe, expect, it } from "vitest";
import { filterSettings } from "@/lib/settings/filter";

const s = (id: string, name: string, description: string | null = null) => ({
  id,
  name,
  description,
  notes: null,
});
const categories = [
  {
    id: "c1",
    name: "Crosshair",
    settings: [s("a", "Length"), s("b", "Gap", "Space in the middle")],
  },
  { id: "c2", name: "Audio", settings: [s("c", "Master Volume")] },
];

describe("filterSettings", () => {
  it("returns null when nothing is filtered", () => {
    expect(filterSettings(categories, "  ", null)).toBeNull();
  });

  it("matches every word across name, category and description", () => {
    const r = filterSettings(categories, "crosshair middle", null)!;
    expect([...r.keys()]).toEqual(["c1"]);
    expect(r.get("c1")!.map((x) => x.id)).toEqual(["b"]);
  });

  it("matches config keys", () => {
    const r = filterSettings(categories, "volume_main", null, (x) =>
      x.id === "c" ? ["snd_volume_main"] : [],
    )!;
    expect(r.get("c2")!.map((x) => x.id)).toEqual(["c"]);
  });

  it("limits to one category, and keeps it even when empty", () => {
    expect(filterSettings(categories, "", "c2")!.get("c2")!.length).toBe(1);
    expect(filterSettings(categories, "length", "c2")!.size).toBe(0);
  });
});
