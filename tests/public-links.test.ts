import { describe, expect, it } from "vitest";
import { linkMeta } from "@/lib/public/links";

describe("linkMeta", () => {
  it("picks an icon and label from the host", () => {
    expect(linkMeta("https://www.twitch.tv/someone")).toEqual({ icon: "twitch", label: "Twitch" });
    expect(linkMeta("https://youtube.com/@someone")).toEqual({ icon: "youtube", label: "YouTube" });
    expect(linkMeta("https://youtu.be/abc")).toEqual({ icon: "youtube", label: "YouTube" });
    expect(linkMeta("https://x.com/someone")).toEqual({ icon: "x", label: "X" });
    expect(linkMeta("https://twitter.com/someone")).toEqual({ icon: "x", label: "X" });
    expect(linkMeta("https://discord.gg/abc")).toEqual({ icon: "discord", label: "Discord" });
    expect(linkMeta("https://github.com/someone")).toEqual({ icon: "github", label: "GitHub" });
    expect(linkMeta("https://someone.dev/")).toEqual({ icon: "globe", label: "someone.dev" });
  });
  it("falls back to globe for junk", () => {
    expect(linkMeta("not a url")).toEqual({ icon: "globe", label: "not a url" });
  });
});
