import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "@/lib/auth/companion-token";

describe("companion tokens", () => {
  it("generates gsv_ tokens with a stable sha256", () => {
    const { token, hash } = generateToken();
    expect(token).toMatch(/^csync_[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generateToken().token).not.toBe(token);
  });
});
