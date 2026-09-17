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
