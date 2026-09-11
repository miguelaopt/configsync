import { describe, expect, it } from "vitest";
import { camelKey, formatForCopy } from "@/lib/copy/format";

const controls = {
  name: "Controls",
  settings: [
    { name: "Sensitivity", type: "integer" as const, value: 8 },
    { name: "ADS Sensitivity", type: "decimal" as const, value: 0.85 },
    { name: "Vibration", type: "boolean" as const, value: false },
  ],
};
const display = {
  name: "Display",
  settings: [{ name: "Resolution", type: "resolution" as const, value: { width: 2560, height: 1440 } }],
};

describe("formatForCopy", () => {
  it("plain: one category → bare lines (matches the product spec)", () => {
    expect(formatForCopy({ categories: [controls] }, "plain")).toBe(
      "Sensitivity: 8\nADS Sensitivity: 0.85\nVibration: Off",
    );
  });

  it("plain: several categories get bracketed headers and a title", () => {
    const out = formatForCopy({ title: "GTA V — Main Setup", categories: [controls, display] }, "plain");
    expect(out).toBe(
      [
        "GTA V — Main Setup",
        "",
        "[Controls]",
        "Sensitivity: 8",
        "ADS Sensitivity: 0.85",
        "Vibration: Off",
        "",
        "[Display]",
        "Resolution: 2560×1440",
      ].join("\n"),
    );
  });

  it("markdown: headings + bullet list", () => {
    expect(formatForCopy({ categories: [controls] }, "markdown")).toBe(
      "### Controls\n- Sensitivity: 8\n- ADS Sensitivity: 0.85\n- Vibration: Off",
    );
  });

  it("json: camelCase keys with raw values", () => {
    expect(JSON.parse(formatForCopy({ categories: [controls] }, "json"))).toEqual({
      sensitivity: 8,
      adsSensitivity: 0.85,
      vibration: false,
    });
    expect(JSON.parse(formatForCopy({ categories: [controls, display] }, "json"))).toEqual({
      controls: { sensitivity: 8, adsSensitivity: 0.85, vibration: false },
      display: { resolution: { width: 2560, height: 1440 } },
    });
  });

  it("json: duplicate names don't clobber each other", () => {
    const out = JSON.parse(
      formatForCopy(
        { categories: [{ name: "X", settings: [
          { name: "FOV", type: "integer", value: 1 },
          { name: "fov", type: "integer", value: 2 },
        ] }] },
        "json",
      ),
    );
    expect(out).toEqual({ fov: 1, fov2: 2 });
  });
});

describe("camelKey", () => {
  it("handles punctuation, unicode and leading digits", () => {
    expect(camelKey("ADS Sensitivity")).toBe("adsSensitivity");
    expect(camelKey("V-Sync")).toBe("vSync");
    expect(camelKey("2x MSAA")).toBe("_2xMsaa");
    expect(camelKey("Résolution")).toBe("resolution");
    expect(camelKey("???")).toBe("value");
  });
});
