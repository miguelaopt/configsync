import { describe, expect, it } from "vitest";
import { everyDay, planCounts, revenue } from "@/lib/admin/metrics";
import type { PlanRow } from "@/lib/billing/paddle";

const at = new Date("2026-09-20T12:00:00Z");
const tx = (grand: string, earnings: string, receivedAt = at) => ({
  eventType: "transaction.completed",
  receivedAt,
  payload: {
    data: { details: { totals: { grand_total: grand, earnings, currency_code: "EUR" } } },
  },
});
const adj = (id: string, status: string, total: string) => ({
  eventType: status === "approved" ? "adjustment.updated" : "adjustment.created",
  receivedAt: at,
  payload: { data: { id, action: "refund", status, totals: { total, currency_code: "EUR" } } },
});

describe("revenue", () => {
  it("sums sales in minor units and counts an approved refund once", () => {
    const [eur] = revenue([
      tx("2499", "1901"),
      tx("299", "180"),
      { eventType: "subscription.updated", receivedAt: at, payload: { data: {} } },
      adj("adj_1", "pending_approval", "299"),
      adj("adj_1", "approved", "299"),
      adj("adj_2", "rejected", "2499"),
    ]);
    expect(eur).toEqual({ currency: "EUR", gross: 27.98, net: 20.81, refunded: 2.99, sales: 2 });
  });

  it("drops events before `since`", () => {
    const old = tx("2499", "1901", new Date("2026-08-01T00:00:00Z"));
    expect(revenue([old, tx("299", "180")], new Date("2026-09-01"))[0]!.sales).toBe(1);
  });
});

describe("planCounts", () => {
  const row = (source: PlanRow["source"], status: string | null, end?: string): PlanRow => ({
    userId: "u",
    source,
    paddleCustomerId: null,
    paddleSubscriptionId: null,
    subscriptionStatus: status,
    currentPeriodEnd: end ? new Date(end) : null,
  });

  it("splits Pro by where it comes from", () => {
    expect(
      planCounts(
        [
          row("subscription", "active"),
          row("subscription", "past_due"),
          row("subscription", "canceled", "2026-10-01"),
          row("subscription", "canceled", "2026-09-01"),
          row("lifetime", null),
          row("manual", null),
        ],
        at,
      ),
    ).toEqual({ pro: 5, monthly: 2, lifetime: 1, manual: 1, pastDue: 1, ending: 1 });
  });
});

describe("everyDay", () => {
  it("fills the missing days with zero, oldest first", () => {
    expect(everyDay([{ day: "2026-09-19", n: 3 }], 3, at)).toEqual([
      { day: "2026-09-18", n: 0 },
      { day: "2026-09-19", n: 3 },
      { day: "2026-09-20", n: 0 },
    ]);
  });
});
