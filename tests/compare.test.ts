import { describe, expect, it } from "vitest";
import { comparePresets } from "@/lib/compare/diff";

const a = [
  {
    name: "Controls",
    settings: [
      { name: "Sensitivity", type: "integer" as const, value: 8 },
      { name: "Vibration", type: "boolean" as const, value: false },
      { name: "Aim Assist", type: "boolean" as const, value: true },
    ],
  },
  { name: "Audio", settings: [{ name: "Music", type: "percentage" as const, value: 30 }] },
];
const b = [
  {
    name: "controls ",
    settings: [
      { name: "sensitivity", type: "integer" as const, value: 6 },
      { name: "Vibration", type: "boolean" as const, value: true },
      { name: "FOV", type: "integer" as const, value: 110 },
    ],
  },
  { name: "Display", settings: [{ name: "Brightness", type: "percentage" as const, value: 50 }] },
];

describe("comparePresets", () => {
  it("classifies same / changed / added / removed, matching names case-insensitively", () => {
    const diff = comparePresets(a, b);
    expect(diff.counts).toEqual({ same: 0, changed: 2, added: 2, removed: 2 });
    const controls = diff.categories.find((c) => c.name === "Controls")!;
    expect(controls.entries.map((e) => [e.name, e.status])).toEqual([
      ["Sensitivity", "changed"],
      ["Vibration", "changed"],
      ["Aim Assist", "removed"],
      ["FOV", "added"],
    ]);
    expect(controls.entries[0]).toMatchObject({ aDisplay: "8", bDisplay: "6" });
    expect(controls.entries[1]).toMatchObject({ aDisplay: "Off", bDisplay: "On" });
    expect(diff.categories.map((c) => c.name)).toEqual(["Controls", "Audio", "Display"]);
    expect(diff.categories[1]!.entries[0]!.status).toBe("removed");
    expect(diff.categories[2]!.entries[0]!.status).toBe("added");
  });

  it("treats identical presets as all same", () => {
    const diff = comparePresets(a, a);
    expect(diff.counts).toEqual({ same: 4, changed: 0, added: 0, removed: 0 });
  });

  it("a type change counts as changed even when the display matches", () => {
    const diff = comparePresets(
      [{ name: "X", settings: [{ name: "S", type: "text", value: "8" }] }],
      [{ name: "X", settings: [{ name: "S", type: "integer", value: 8 }] }],
    );
    expect(diff.counts.changed).toBe(1);
  });
});
