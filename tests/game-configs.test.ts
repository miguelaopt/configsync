import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCatalogGame } from "@/lib/catalog";
import { readGameConfig, writeGameConfig } from "@/lib/game-configs";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");
const cs2 = getCatalogGame("cs2")!;
const rl = getCatalogGame("rocket-league")!;
const cs2Files = {
  video: fx("cs2_video.txt"),
  convars: fx("cs2_user_convars.vcfg"),
  keys: fx("cs2_user_keys.vcfg"),
};
type P = { categories: { name: string; settings: { name: string; value?: unknown }[] }[] };
const find = (p: P, cat: string, name: string) =>
  p.categories.find((c) => c.name === cat)!.settings.find((s) => s.name === name)!;

describe("readGameConfig", () => {
  it("reads CS2 video, convars and binds; defaults elsewhere", () => {
    const r = readGameConfig(cs2, cs2Files);
    expect(find(r.preset, "Video", "Resolution").value).toEqual({ width: 1280, height: 960 });
    expect(find(r.preset, "Video", "Display Mode").value).toBe("Fullscreen Windowed");
    expect(find(r.preset, "Video", "Multisampling Anti-Aliasing Mode").value).toBe("4x MSAA");
    expect(find(r.preset, "Video", "Wait for Vertical Sync").value).toBe(false);
    expect(find(r.preset, "Keyboard / Mouse", "Mouse Sensitivity").value).toBeTypeOf("number");
    expect(find(r.preset, "Crosshair", "Outline").value).toBe(true);
    expect(find(r.preset, "Keybinds", "Toggle Console").value).toBe("p");
    expect(find(r.preset, "Keybinds", "Fire").value).toBe("mouse1"); // default, not in file
    expect(r.missingFiles).toEqual([]);
    expect(r.unmappedSettings).toContain("Video › Brightness");
  });
  it("reports missing files and keeps defaults", () => {
    const r = readGameConfig(cs2, { video: cs2Files.video });
    expect(r.missingFiles).toEqual(["convars", "keys"]);
    expect(find(r.preset, "Crosshair", "Length").value).toBe(5);
  });
  it("warns on values it cannot decode", () => {
    const broken = cs2Files.video.replace(
      '"setting.mat_vsync"\t\t"0"',
      '"setting.mat_vsync"\t\t"maybe"',
    );
    const r = readGameConfig(cs2, { video: broken });
    expect(r.warnings.some((w) => w.includes("mat_vsync"))).toBe(true);
    expect(find(r.preset, "Video", "Wait for Vertical Sync").value).toBe(false);
  });
  it("reads Rocket League video + input and lists camera as unmapped", () => {
    const r = readGameConfig(rl, { video: fx("TASystemSettings.ini"), input: fx("TAInput.ini") });
    expect(find(r.preset, "Video", "Resolution").value).toEqual({ width: 1920, height: 1080 });
    expect(find(r.preset, "Video", "Display Mode").value).toBe("Fullscreen");
    expect(find(r.preset, "Video", "Motion Blur").value).toBe(false);
    expect(find(r.preset, "Controls", "Mouse Sensitivity").value).toBe(10);
    expect(r.unmappedSettings).toContain("Camera › Field of View");
  });
});

describe("writeGameConfig", () => {
  it("round-trips: read → write → read is stable", () => {
    const first = readGameConfig(cs2, cs2Files);
    const w = writeGameConfig(cs2, first.preset, cs2Files);
    const second = readGameConfig(cs2, { ...cs2Files, ...w.files });
    expect(second.preset).toEqual(first.preset);
  });
  it("writes changed values in the file's boolean style and unbinds the default key", () => {
    const r = readGameConfig(cs2, cs2Files);
    find(r.preset, "Video", "Wait for Vertical Sync").value = true;
    find(r.preset, "Crosshair", "Outline").value = false;
    find(r.preset, "Video", "Display Mode").value = "Windowed";
    find(r.preset, "Keybinds", "Jump").value = "mouse4";
    const w = writeGameConfig(cs2, r.preset, cs2Files);
    expect(w.files.video).toContain('"setting.mat_vsync"\t\t"1"');
    expect(w.files.video).toContain('"setting.nowindowborder"\t\t"0"');
    expect(w.files.convars).toContain('"cl_crosshair_drawoutline"\t\t"false"');
    expect(w.files.keys).toContain('"mouse4"\t\t"+jump"');
    expect(w.files.keys).toContain('"space"\t\t"<unbound>"');
  });
  it("skips settings whose file was not provided", () => {
    const r = readGameConfig(cs2, cs2Files);
    const w = writeGameConfig(cs2, r.preset, { video: cs2Files.video });
    expect(w.files.convars).toBeUndefined();
    expect(w.skipped.some((s) => s.startsWith("Crosshair"))).toBe(true);
  });
  it("patches Rocket League ini and keeps other sections", () => {
    const files = { video: fx("TASystemSettings.ini"), input: fx("TAInput.ini") };
    const r = readGameConfig(rl, files);
    find(r.preset, "Video", "Display Mode").value = "Borderless";
    const w = writeGameConfig(rl, r.preset, files);
    expect(w.files.video).toContain("Borderless=True");
    expect(w.files.video).toContain("Fullscreen=False");
    expect(w.files.video).toContain("[SystemSettingsBucket1]");
  });
});
