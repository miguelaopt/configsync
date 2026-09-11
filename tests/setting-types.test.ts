import { describe, expect, it } from "vitest";
import {
  formatValue,
  valueSchemaFor,
  valuesEqual,
  SETTING_TYPES,
  SETTING_TYPE_IDS,
} from "@/lib/settings/types";

describe("valueSchemaFor", () => {
  it("validates booleans", () => {
    expect(valueSchemaFor({ type: "boolean" }).safeParse(true).success).toBe(true);
    expect(valueSchemaFor({ type: "boolean" }).safeParse("yes").success).toBe(false);
  });

  it("enforces integer + range", () => {
    const s = valueSchemaFor({ type: "integer", min: 1, max: 10 });
    expect(s.safeParse(8).success).toBe(true);
    expect(s.safeParse(8.5).success).toBe(false);
    expect(s.safeParse(11).success).toBe(false);
    expect(s.safeParse(0).success).toBe(false);
  });

  it("percentage defaults to 0..100", () => {
    const s = valueSchemaFor({ type: "percentage" });
    expect(s.safeParse(100).success).toBe(true);
    expect(s.safeParse(101).success).toBe(false);
  });

  it("restricts choices to options when provided", () => {
    const def = { type: "dropdown" as const, options: [{ label: "Low", value: "low" }] };
    expect(valueSchemaFor(def).safeParse("low").success).toBe(true);
    expect(valueSchemaFor(def).safeParse("ultra").success).toBe(false);
    expect(valueSchemaFor({ type: "dropdown" }).safeParse("anything").success).toBe(true);
  });

  it("validates multi_select arrays, colors and resolutions", () => {
    expect(valueSchemaFor({ type: "multi_select" }).safeParse(["a", "b"]).success).toBe(true);
    expect(valueSchemaFor({ type: "multi_select" }).safeParse("a").success).toBe(false);
    expect(valueSchemaFor({ type: "color" }).safeParse("#ff8800").success).toBe(true);
    expect(valueSchemaFor({ type: "color" }).safeParse("orange").success).toBe(false);
    expect(
      valueSchemaFor({ type: "resolution" }).safeParse({ width: 1920, height: 1080 }).success,
    ).toBe(true);
    expect(
      valueSchemaFor({ type: "resolution" }).safeParse({ width: 0, height: 1080 }).success,
    ).toBe(false);
  });

  it("every type has metadata and a default value that validates", () => {
    for (const type of SETTING_TYPE_IDS) {
      const meta = SETTING_TYPES[type];
      expect(meta.label).toBeTruthy();
      const def = { type, options: [{ label: "A", value: "a" }] };
      const value = meta.defaultValue(def);
      expect(valueSchemaFor(def).safeParse(value).success, type).toBe(true);
    }
  });
});

describe("formatValue", () => {
  it("formats each kind of value for humans", () => {
    expect(formatValue({ type: "boolean" }, true)).toBe("On");
    expect(formatValue({ type: "boolean" }, false)).toBe("Off");
    expect(formatValue({ type: "percentage" }, 30)).toBe("30%");
    expect(formatValue({ type: "decimal", unit: "ms" }, 0.85)).toBe("0.85 ms");
    expect(formatValue({ type: "integer" }, 8)).toBe("8");
    expect(formatValue({ type: "resolution" }, { width: 1920, height: 1080 })).toBe("1920×1080");
    expect(
      formatValue({ type: "enum", options: [{ label: "Ultra", value: "ultra" }] }, "ultra"),
    ).toBe("Ultra");
    expect(
      formatValue({ type: "multi_select", options: [{ label: "Blood", value: "blood" }] }, [
        "blood",
        "gore",
      ]),
    ).toBe("Blood, gore");
    expect(formatValue({ type: "text" }, "")).toBe("—");
    expect(formatValue({ type: "text" }, null)).toBe("—");
  });
});

describe("valuesEqual", () => {
  it("compares primitives, arrays and resolutions structurally", () => {
    expect(valuesEqual(8, 8)).toBe(true);
    expect(valuesEqual(8, 9)).toBe(false);
    expect(valuesEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(valuesEqual(["a", "b"], ["b", "a"])).toBe(false);
    expect(valuesEqual({ width: 1, height: 2 }, { width: 1, height: 2 })).toBe(true);
    expect(valuesEqual(null, null)).toBe(true);
    expect(valuesEqual(null, 0)).toBe(false);
  });
});
