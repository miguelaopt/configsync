import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Plan } from "./limits";

export type PlanSource = "subscription" | "lifetime" | "manual";
export type PlanRow = {
  userId: string;
  source: PlanSource;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
};

/** Plan at `now`, derived from the stored row. Never stored: a canceled sub expires by itself. */
export function resolvePlan(row: PlanRow | null, now = new Date()): Plan {
  if (!row) return "free";
  if (row.source === "lifetime" || row.source === "manual") return "pro";
  switch (row.subscriptionStatus) {
    case "active":
    case "trialing":
    case "past_due": // Paddle keeps retrying; a final failure arrives as subscription.canceled
      return "pro";
    case "canceled":
      return row.currentPeriodEnd && row.currentPeriodEnd > now ? "pro" : "free";
    default:
      return "free";
  }
}

/** `Paddle-Signature: ts=<unix>;h1=<hex>[;h1=<hex>]` over `${ts}:${rawBody}`. 5-minute skew window. */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!header) return false;
  const parts = header.split(";").map((p) => p.split("=", 2) as [string, string | undefined]);
  const ts = parts.find(([k]) => k === "ts")?.[1];
  const h1s = parts.filter(([k]) => k === "h1").map(([, v]) => v ?? "");
  if (!ts || !/^\d+$/.test(ts) || h1s.length === 0) return false;
  if (Math.abs(nowMs / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  return h1s.some(
    (h) => h.length === expected.length && timingSafeEqual(Buffer.from(h), Buffer.from(expected)),
  );
}

export const paddleEventSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  data: z.object({
    id: z.string(),
    status: z.string().optional(),
    /** Adjustments only: refund | chargeback | chargeback_warning | chargeback_reverse | credit. */
    action: z.string().optional(),
    /** Adjustments only: full | partial. */
    type: z.string().optional(),
    customer_id: z.string().nullish(),
    subscription_id: z.string().nullish(),
    custom_data: z.object({ userId: z.string().min(1).max(64).optional() }).nullish(),
    current_billing_period: z.object({ ends_at: z.string() }).nullish(),
    /**
     * Transactions carry `price.id`, which is how a lifetime purchase is recognised. Adjustments
     * carry items too, but theirs have `item_id`/`amount`/`totals` and no price at all — so this
     * must not require one, or a refund is rejected as an unexpected shape and never recorded.
     */
    items: z.array(z.object({ price: z.object({ id: z.string() }).nullish() })).optional(),
  }),
});
export type PaddleEvent = z.infer<typeof paddleEventSchema>;

const REVOKING_ACTIONS = new Set(["refund", "chargeback"]);

/**
 * Next plan row after one event; null = nothing to store. Lifetime is downgraded only by an
 * approved full refund or chargeback; manual grants are never touched by Paddle.
 */
export function applyPaddleEvent(
  current: PlanRow | null,
  event: PaddleEvent,
  userId: string,
  lifetimePriceId: string,
): PlanRow | null {
  const d = event.data;
  if (event.event_type.startsWith("adjustment.")) {
    const revokes =
      REVOKING_ACTIONS.has(d.action ?? "") && d.status === "approved" && d.type !== "partial";
    if (!revokes || current?.source === "manual") return null;
    return {
      userId,
      source: "subscription",
      paddleCustomerId: d.customer_id ?? current?.paddleCustomerId ?? null,
      paddleSubscriptionId: d.subscription_id ?? current?.paddleSubscriptionId ?? null,
      subscriptionStatus: "canceled",
      currentPeriodEnd: null, // canceled with no paid period left ⇒ free now
    };
  }
  if (event.event_type === "transaction.completed") {
    if (!lifetimePriceId || !d.items?.some((i) => i.price?.id === lifetimePriceId)) return null;
    return {
      userId,
      source: "lifetime",
      paddleCustomerId: d.customer_id ?? current?.paddleCustomerId ?? null,
      paddleSubscriptionId: current?.paddleSubscriptionId ?? null,
      subscriptionStatus: current?.subscriptionStatus ?? null,
      currentPeriodEnd: current?.currentPeriodEnd ?? null,
    };
  }
  if (!event.event_type.startsWith("subscription.")) return null;
  return {
    userId,
    source: current?.source === "lifetime" ? "lifetime" : "subscription",
    paddleCustomerId: d.customer_id ?? current?.paddleCustomerId ?? null,
    paddleSubscriptionId: d.id,
    subscriptionStatus: d.status ?? current?.subscriptionStatus ?? null,
    currentPeriodEnd: d.current_billing_period ? new Date(d.current_billing_period.ends_at) : null,
  };
}
