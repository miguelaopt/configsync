import { describe, expect, it } from "vitest";
import { deviceStatus } from "@/lib/companion/device-status";

const at = "2026-09-19T10:00:00.000Z";
const applied = { presetSlug: "main", version: "aaaa", at, status: "applied" as const };
const want = { presetSlug: "main", version: "aaaa" };

describe("deviceStatus", () => {
  it("never synced when the daemon reported nothing for the game", () => {
    expect(deviceStatus(undefined, want)).toEqual({ kind: "never" });
  });
  it("applied when the last write matches what the server wants now", () => {
    expect(deviceStatus(applied, want)).toEqual({ kind: "applied", presetSlug: "main", at });
    expect(deviceStatus(applied, null)).toEqual({ kind: "applied", presetSlug: "main", at });
  });
  it("stale when the server wants a different preset or version", () => {
    expect(deviceStatus(applied, { presetSlug: "main", version: "bbbb" })).toEqual({
      kind: "stale",
      presetSlug: "main",
      at,
    });
    expect(deviceStatus(applied, { presetSlug: "laptop", version: "aaaa" }).kind).toBe("stale");
  });
  it("waiting and failed come straight from the daemon's report", () => {
    expect(deviceStatus({ ...applied, status: "waiting" }, want)).toEqual({
      kind: "waiting",
      presetSlug: "main",
    });
    expect(deviceStatus({ presetSlug: "", version: "", at: "", status: "waiting" }, want)).toEqual({
      kind: "waiting",
      presetSlug: "",
    });
    expect(deviceStatus({ ...applied, status: "failed" }, want)).toEqual({
      kind: "failed",
      presetSlug: "main",
      at,
    });
  });
});
