import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { limitsFor, LIMITS } from "@/lib/billing/limits";
import {
  applyPaddleEvent,
  resolvePlan,
  verifyPaddleSignature,
  type PlanRow,
} from "@/lib/billing/paddle";

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
  it("free is 3 games, 10 snapshots and no AI; pro is unlimited with 30 screenshots a day", () => {
    expect(limitsFor("free")).toEqual({ games: 3, revisions: 10, aiScreenshots: 0 });
    expect(limitsFor("pro")).toEqual({ games: Infinity, revisions: Infinity, aiScreenshots: 30 });
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

const secret = "whsec_test";
const sign = (body: string, ts: number) =>
  `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;

describe("verifyPaddleSignature", () => {
  const body = '{"event_id":"evt_1"}';
  const ts = Math.floor(now.getTime() / 1000);
  it("accepts a valid signature and rejects tampering, staleness and junk", () => {
    expect(verifyPaddleSignature(body, sign(body, ts), secret, now.getTime())).toBe(true);
    expect(verifyPaddleSignature(body + " ", sign(body, ts), secret, now.getTime())).toBe(false);
    expect(verifyPaddleSignature(body, sign(body, ts - 600), secret, now.getTime())).toBe(false);
    expect(verifyPaddleSignature(body, "nonsense", secret, now.getTime())).toBe(false);
    expect(verifyPaddleSignature(body, null, secret, now.getTime())).toBe(false);
  });
  it("accepts any of several h1 values during secret rotation", () => {
    const good = sign(body, ts);
    expect(verifyPaddleSignature(body, `${good};h1=deadbeef`, secret, now.getTime())).toBe(true);
  });
});

describe("applyPaddleEvent", () => {
  const LIFETIME = "pri_life";
  const sub = (type: string, status: string, endsAt: string | null = "2026-10-17T12:00:00Z") => ({
    event_id: "evt_x",
    event_type: type,
    data: {
      id: "sub_1",
      status,
      customer_id: "ctm_1",
      custom_data: { userId: "u1" },
      current_billing_period: endsAt ? { ends_at: endsAt } : null,
    },
  });
  it("lifetime transaction sets source lifetime and keeps the customer id", () => {
    const next = applyPaddleEvent(
      null,
      {
        event_id: "evt_1",
        event_type: "transaction.completed",
        data: {
          id: "txn_1",
          customer_id: "ctm_1",
          custom_data: { userId: "u1" },
          items: [{ price: { id: LIFETIME } }],
        },
      },
      "u1",
      LIFETIME,
    );
    expect(next).toMatchObject({ userId: "u1", source: "lifetime", paddleCustomerId: "ctm_1" });
  });
  it("a subscription transaction is a no-op (subscription events carry the state)", () => {
    const next = applyPaddleEvent(
      null,
      {
        event_id: "evt_2",
        event_type: "transaction.completed",
        data: {
          id: "txn_2",
          customer_id: "ctm_1",
          subscription_id: "sub_1",
          items: [{ price: { id: "pri_month" } }],
        },
      },
      "u1",
      LIFETIME,
    );
    expect(next).toBeNull();
  });
  it("subscription events set status, ids and period end", () => {
    const next = applyPaddleEvent(null, sub("subscription.activated", "active"), "u1", LIFETIME);
    expect(next).toEqual({
      userId: "u1",
      source: "subscription",
      paddleCustomerId: "ctm_1",
      paddleSubscriptionId: "sub_1",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date("2026-10-17T12:00:00Z"),
    });
    const canceled = applyPaddleEvent(
      next,
      sub("subscription.canceled", "canceled", null),
      "u1",
      LIFETIME,
    );
    expect(canceled).toMatchObject({ subscriptionStatus: "canceled", currentPeriodEnd: null });
  });
  it("lifetime wins: a later canceled subscription keeps source lifetime", () => {
    const life = row({ source: "lifetime", subscriptionStatus: null, paddleSubscriptionId: null });
    const next = applyPaddleEvent(
      life,
      sub("subscription.canceled", "canceled", null),
      "u1",
      LIFETIME,
    );
    expect(next).toMatchObject({
      source: "lifetime",
      subscriptionStatus: "canceled",
      paddleSubscriptionId: "sub_1",
    });
  });
  it("ignores unrelated event types", () => {
    expect(
      applyPaddleEvent(
        null,
        { event_id: "e", event_type: "customer.updated", data: { id: "ctm_1" } },
        "u1",
        LIFETIME,
      ),
    ).toBeNull();
  });
});
