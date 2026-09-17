import { describe, expect, it } from "vitest";
import { limitsFor, LIMITS } from "@/lib/billing/limits";
import { resolvePlan, type PlanRow } from "@/lib/billing/paddle";

const row = (over: Partial<PlanRow>): PlanRow => ({
  userId: "u1",
  source: "subscription",
  paddleCustomerId: "ctm_1",
  paddleSubscriptionId: "sub_1",
  subscriptionStatus: "active",
  currentPeriodEnd: null,
  ...over,
});
const now = new Date("2026-09-17T12:00:00Z");

describe("limits", () => {
  it("free is 3 games and 10 snapshots; pro is unlimited", () => {
    expect(limitsFor("free")).toEqual({ games: 3, revisions: 10 });
    expect(limitsFor("pro")).toEqual({ games: Infinity, revisions: Infinity });
    expect(LIMITS.free.games).toBe(3);
  });
});

describe("resolvePlan", () => {
  it("no row is free; lifetime and manual are pro regardless of subscription state", () => {
    expect(resolvePlan(null, now)).toBe("free");
    expect(resolvePlan(row({ source: "lifetime", subscriptionStatus: "canceled" }), now)).toBe(
      "pro",
    );
    expect(resolvePlan(row({ source: "manual", subscriptionStatus: null }), now)).toBe("pro");
  });
  it("active, trialing and past_due subscriptions are pro", () => {
    for (const s of ["active", "trialing", "past_due"])
      expect(resolvePlan(row({ subscriptionStatus: s }), now)).toBe("pro");
  });
  it("canceled stays pro until the period ends, then free", () => {
    const later = new Date("2026-10-01T00:00:00Z");
    expect(resolvePlan(row({ subscriptionStatus: "canceled", currentPeriodEnd: later }), now)).toBe(
      "pro",
    );
    expect(
      resolvePlan(row({ subscriptionStatus: "canceled", currentPeriodEnd: later }), later),
    ).toBe("free");
    expect(resolvePlan(row({ subscriptionStatus: "canceled", currentPeriodEnd: null }), now)).toBe(
      "free",
    );
    expect(resolvePlan(row({ subscriptionStatus: "paused", currentPeriodEnd: later }), now)).toBe(
      "free",
    );
  });
});
