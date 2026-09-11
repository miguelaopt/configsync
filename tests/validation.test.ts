import { describe, expect, it } from "vitest";
import { gameInputSchema, profileInputSchema, settingInputSchema } from "@/lib/validation";

describe("gameInputSchema", () => {
  it("trims, dedupes tags and rejects http covers", () => {
    const r = gameInputSchema.parse({ name: "  GTA V ", tags: ["pc", "pc", " racing "] });
    expect(r.name).toBe("GTA V");
    expect(r.tags).toEqual(["pc", "racing"]);
    expect(gameInputSchema.safeParse({ name: "X", coverUrl: "http://x.com/a.png" }).success).toBe(false);
    expect(gameInputSchema.safeParse({ name: "X", coverUrl: "https://x.com/a.png" }).success).toBe(true);
    expect(gameInputSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("settingInputSchema", () => {
  const base = { categoryId: "8d0f1c1e-1c6b-4c1e-9e2c-2a0b6f7c9d10", name: "FOV", type: "integer" };
  it("rejects min > max", () => {
    expect(settingInputSchema.safeParse({ ...base, min: 10, max: 1 }).success).toBe(false);
    expect(settingInputSchema.safeParse({ ...base, min: 1, max: 10 }).success).toBe(true);
  });
  it("requires a uuid category", () => {
    expect(settingInputSchema.safeParse({ ...base, categoryId: "nope" }).success).toBe(false);
  });
});

describe("profileInputSchema", () => {
  it("normalises usernames", () => {
    expect(profileInputSchema.parse({ username: " Miguel-RF " }).username).toBe("miguel-rf");
    expect(profileInputSchema.safeParse({ username: "-bad" }).success).toBe(false);
    expect(profileInputSchema.safeParse({ username: "ab" }).success).toBe(false);
  });
});
