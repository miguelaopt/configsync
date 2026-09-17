import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseKeyValues, patchKeyValues } from "@/lib/game-configs/formats/keyvalues";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

describe("keyvalues", () => {
  it("parses nested objects and quoted strings", () => {
    const doc = parseKeyValues(fx("cs2_user_keys.vcfg")) as {
      config: { bindings: Record<string, string> };
    };
    expect(doc.config.bindings.p).toBe("toggleconsole");
    expect(doc.config.bindings["`"]).toBe("<unbound>");
  });
  it("parses the video file root object", () => {
    const doc = parseKeyValues(fx("cs2_video.txt")) as { "video.cfg": Record<string, string> };
    expect(doc["video.cfg"]["setting.defaultres"]).toBe("1280");
  });
  it("patches existing keys in place and appends new ones, byte-for-byte elsewhere", () => {
    const src = fx("cs2_video.txt");
    const out = patchKeyValues(src, ["video.cfg"], {
      "setting.defaultres": "1920",
      "setting.brand_new": "7",
    });
    expect(out).toContain('"setting.defaultres"\t\t"1920"');
    expect(out).toContain('"setting.brand_new"\t\t"7"');
    expect(out.replace(/"1920"/, '"1280"').replace(/\t"setting.brand_new"\t\t"7"\n/, "")).toBe(src);
  });
  it("patches a nested section", () => {
    const out = patchKeyValues(fx("cs2_user_keys.vcfg"), ["config", "bindings"], {
      w: "+forward",
      p: "<unbound>",
    });
    const doc = parseKeyValues(out) as {
      config: { bindings: Record<string, string>; analogbindings: Record<string, string> };
    };
    expect(doc.config.bindings.w).toBe("+forward");
    expect(doc.config.bindings.p).toBe("<unbound>");
    expect(doc.config.analogbindings.MOUSE_X).toBe("yaw");
  });
  it("ignores // comments", () => {
    expect(parseKeyValues('// hi\n"a" { "b" "c" // trailing\n }')).toEqual({ a: { b: "c" } });
  });
});
