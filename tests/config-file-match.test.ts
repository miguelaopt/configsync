import { describe, expect, it } from "vitest";
import { getCatalogGame } from "@/lib/catalog";
import { matchConfigFile } from "@/lib/game-configs/match-file";

describe("matching uploaded config filenames", () => {
  it("matches Rocket League filenames to their catalog IDs", () => {
    const files = getCatalogGame("rocket-league")!.files;
    expect(matchConfigFile(files, "TASystemSettings.ini")?.id).toBe("video");
    expect(matchConfigFile(files, "tainput.INI")?.id).toBe("input");
  });

  it("accepts CS2 config filenames and slot variants", () => {
    const files = getCatalogGame("cs2")!.files;
    expect(matchConfigFile(files, "cs2_video.txt")?.id).toBe("video");
    expect(matchConfigFile(files, "cs2_user_convars_0_slot0.vcfg")?.id).toBe("convars");
    expect(matchConfigFile(files, "cs2_user_keys_1_slot2.vcfg")?.id).toBe("keys");
    expect(matchConfigFile(files, "cs2_user_keys.vcfg")?.id).toBe("keys");
  });

  it("rejects unrelated files and ambiguous names", () => {
    const files = getCatalogGame("cs2")!.files;
    expect(matchConfigFile(files, "monkeys.txt")).toBeUndefined();
    expect(matchConfigFile(files, "video_keys.cfg")).toBeUndefined();
    expect(matchConfigFile(files, "TASystemSettings.ini")).toBeUndefined();
  });
});
