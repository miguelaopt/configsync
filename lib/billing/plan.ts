import "server-only";
import { cache } from "react";
import { and, count, eq } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { billingEnabled } from "@/lib/env";
import { AppError } from "@/lib/data/errors";
import { getPlanRow } from "@/lib/data/billing";
import { GAME_LIMIT_MESSAGE, limitsFor, type Plan } from "./limits";
import { resolvePlan, type PlanSource } from "./paddle";

export type PlanInfo = {
  plan: Plan;
  source: PlanSource | null;
  currentPeriodEnd: Date | null;
  paddleCustomerId: string | null;
  subscriptionStatus: string | null;
};

/** The one place that answers "is this user Pro?". Self-host (no Paddle) ⇒ everyone is. */
export const getPlan = cache(async (userId: string): Promise<PlanInfo> => {
  if (!billingEnabled)
    return {
      plan: "pro",
      source: "manual",
      currentPeriodEnd: null,
      paddleCustomerId: null,
      subscriptionStatus: null,
    };
  const row = await getPlanRow(userId);
  return {
    plan: resolvePlan(row),
    source: row?.source ?? null,
    currentPeriodEnd: row?.currentPeriodEnd ?? null,
    paddleCustomerId: row?.paddleCustomerId ?? null,
    subscriptionStatus: row?.subscriptionStatus ?? null,
  };
});

/** Throws before any write when a Free user already has the maximum of active games. */
export async function assertCanAddGame(userId: string, tx: Tx | typeof db = db) {
  const { plan } = await getPlan(userId);
  const max = limitsFor(plan).games;
  if (max === Infinity) return;
  const [row] = await tx
    .select({ n: count() })
    .from(schema.games)
    .where(and(eq(schema.games.userId, userId), eq(schema.games.isArchived, false)));
  if ((row?.n ?? 0) >= max) throw new AppError(GAME_LIMIT_MESSAGE, "forbidden");
}
