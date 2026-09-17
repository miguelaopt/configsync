import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIni, patchIni } from "@/lib/game-configs/formats/ini";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

describe("ini", () => {
  it("reads the first section occurrence and keeps repeated keys' first value", () => {
    const doc = parseIni(fx("TASystemSettings.ini"));
    expect(doc.SystemSettings!.ResX).toBe("1920");
    expect(doc.SystemSettingsBucket1!.ResX).toBe("1280");
    const input = parseIni(fx("TAInput.ini"));
    expect(input["TAGame.PlayerInput_TA"]!.MouseSensitivity).toBe("10");
  });
  it("patches only the named section, keeps line endings, appends missing keys", () => {
    const src = fx("TASystemSettings.ini");
    const out = patchIni(src, "SystemSettings", { ResX: "2560", NewKey: "1" });
    expect(out).toContain("ResX=2560\r\n");
    expect(parseIni(out).SystemSettingsBucket1!.ResX).toBe("1280");
    expect(parseIni(out).SystemSettings!.NewKey).toBe("1");
    expect(out.replace("ResX=2560", "ResX=1920").replace("NewKey=1\r\n", "")).toBe(src);
  });
  it("throws when the section is missing", () => {
    expect(() => patchIni("[A]\nx=1\n", "B", { x: "2" })).toThrow(/Section/);
  });
});
