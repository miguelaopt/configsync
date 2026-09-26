/** Pure numbers for /admin, computed from rows the data layer loads. */
import { resolvePlan, type PlanRow } from "@/lib/billing/paddle";

export type Money = {
  currency: string;
  gross: number;
  net: number;
  refunded: number;
  sales: number;
};

type BillingEventRow = { eventType: string; payload: unknown; receivedAt: Date };

type Totals = { grand_total?: string; total?: string; earnings?: string; currency_code?: string };
/** Paddle amounts are strings in cents; summed as integers, divided once at the end. */
const cents = (s: string | undefined) => (s && /^-?\d+$/.test(s) ? Number(s) : 0);

/**
 * Revenue per currency from the stored Paddle webhooks: gross is what customers paid (tax
 * included), net is Paddle's `earnings` (after tax and its fee), refunded is approved refunds.
 * An adjustment arrives as `created` then `updated`; only its latest approved state counts.
 */
export function revenue(events: BillingEventRow[], since?: Date): Money[] {
  const by = new Map<string, Money>();
  const get = (c: string) => {
    let m = by.get(c);
    if (!m) by.set(c, (m = { currency: c, gross: 0, net: 0, refunded: 0, sales: 0 }));
    return m;
  };
  const adjustments = new Map<string, { status?: string; action?: string; totals?: Totals }>();
  for (const e of events) {
    if (since && e.receivedAt < since) continue;
    const data = (e.payload as { data?: Record<string, unknown> } | null)?.data ?? {};
    if (e.eventType === "transaction.completed") {
      const t = ((data.details as { totals?: Totals } | undefined)?.totals ?? {}) as Totals;
      const currency = t.currency_code ?? (data.currency_code as string | undefined) ?? "EUR";
      const m = get(currency);
      m.gross += cents(t.grand_total ?? t.total);
      m.net += cents(t.earnings);
      m.sales += 1;
    } else if (e.eventType.startsWith("adjustment.") && typeof data.id === "string") {
      adjustments.set(data.id, {
        status: data.status as string | undefined,
        action: data.action as string | undefined,
        totals: data.totals as Totals | undefined,
      });
    }
  }
  for (const a of adjustments.values()) {
    if (a.status !== "approved" || a.action !== "refund" || !a.totals) continue;
    get(a.totals.currency_code ?? "EUR").refunded += cents(a.totals.total);
  }
  return [...by.values()]
    .map((m) => ({ ...m, gross: m.gross / 100, net: m.net / 100, refunded: m.refunded / 100 }))
    .sort((a, b) => b.gross - a.gross);
}

export type PlanCounts = {
  pro: number;
  monthly: number;
  lifetime: number;
  manual: number;
  /** Paid monthly, payment failing; Paddle is retrying. */
  pastDue: number;
  /** Canceled, Pro until the period ends. */
  ending: number;
};

export function planCounts(rows: PlanRow[], now = new Date()): PlanCounts {
  const c: PlanCounts = { pro: 0, monthly: 0, lifetime: 0, manual: 0, pastDue: 0, ending: 0 };
  for (const r of rows) {
    if (resolvePlan(r, now) !== "pro") continue;
    c.pro++;
    if (r.source === "lifetime") c.lifetime++;
    else if (r.source === "manual") c.manual++;
    else if (r.subscriptionStatus === "canceled") c.ending++;
    else {
      c.monthly++;
      if (r.subscriptionStatus === "past_due") c.pastDue++;
    }
  }
  return c;
}

/** `{ day: "2026-09-01", n }` rows → one entry per day for the last `days` days, zeros filled. */
export function everyDay(rows: { day: string; n: number }[], days: number, now = new Date()) {
  const n = new Map(rows.map((r) => [r.day, Number(r.n)]));
  const out: { day: string; n: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    out.push({ day, n: n.get(day) ?? 0 });
  }
  return out;
}

export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
