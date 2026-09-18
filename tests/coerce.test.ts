import { describe, expect, it } from "vitest";
import { coerceValue } from "@/lib/settings/coerce";
import type { SettingDefinition } from "@/lib/settings/types";

const def = (
  type: SettingDefinition["type"],
  extra: Partial<SettingDefinition> = {},
): SettingDefinition => ({ type, ...extra });
const quality = def("enum", {
  options: [
    { label: "High", value: "high" },
    { label: "Low", value: "low" },
  ],
});

describe("coerceValue", () => {
  it("reads booleans from the words games use", () => {
    expect(coerceValue(def("boolean"), "On")).toBe(true);
    expect(coerceValue(def("boolean"), "Disabled")).toBe(false);
    expect(coerceValue(def("boolean"), "Maybe")).toBeNull();
  });

  it("reads numbers, strips units, accepts a decimal comma and honours the definition's range", () => {
    expect(coerceValue(def("integer"), "400 DPI")).toBe(400);
    expect(coerceValue(def("decimal"), "0,85")).toBe(0.85);
    expect(coerceValue(def("percentage"), "85%")).toBe(85);
    expect(coerceValue(def("integer"), "2.5")).toBeNull();
    expect(coerceValue(def("slider", { min: 0, max: 1 }), "1.5")).toBeNull();
    expect(coerceValue(def("percentage"), "150")).toBeNull();
  });

  it("matches choices by label or value, case-insensitively", () => {
    expect(coerceValue(quality, "HIGH")).toBe("high");
    expect(coerceValue(quality, "low")).toBe("low");
    expect(coerceValue(quality, "Ultra")).toBeNull();
    expect(coerceValue(def("dropdown"), "Anything")).toBe("Anything");
    expect(coerceValue(def("multi_select", { options: quality.options }), "High, Low")).toEqual([
      "high",
      "low",
    ]);
    expect(
      coerceValue(def("multi_select", { options: quality.options }), "High, Ultra"),
    ).toBeNull();
  });

  it("reads resolutions and colours, keeps free text trimmed, rejects blanks", () => {
    expect(coerceValue(def("resolution"), "1920 x 1080")).toEqual({ width: 1920, height: 1080 });
    expect(coerceValue(def("resolution"), "2560×1440")).toEqual({ width: 2560, height: 1440 });
    expect(coerceValue(def("resolution"), "1080p")).toBeNull();
    expect(coerceValue(def("color"), "FF8800")).toBe("#ff8800");
    expect(coerceValue(def("color"), "orange")).toBeNull();
    expect(coerceValue(def("keybind"), " Mouse 4 ")).toBe("Mouse 4");
    expect(coerceValue(def("text"), "   ")).toBeNull();
  });
});
