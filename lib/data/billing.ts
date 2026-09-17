import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { PlanRow } from "@/lib/billing/paddle";

const { plans, billingEvents, users } = schema;

export async function getPlanRow(userId: string): Promise<PlanRow | null> {
  const row = await db.query.plans.findFirst({ where: eq(plans.userId, userId) });
  return row ?? null;
}

export async function upsertPlanRow(row: PlanRow) {
  const { userId, ...rest } = row;
  await db
    .insert(plans)
    .values({ userId, ...rest })
    .onConflictDoUpdate({ target: plans.userId, set: rest });
}

/** True when stored now; false when this event id was already seen (Paddle retried). */
export async function recordBillingEvent(event: {
  event_id: string;
  event_type: string;
  userId: string | null;
  payload: unknown;
}) {
  const inserted = await db
    .insert(billingEvents)
    .values({
      id: event.event_id,
      eventType: event.event_type,
      userId: event.userId,
      payload: event.payload as object,
    })
    .onConflictDoNothing()
    .returning({ id: billingEvents.id });
  return inserted.length > 0;
}

export async function findUserIdByCustomer(paddleCustomerId: string) {
  const row = await db.query.plans.findFirst({
    where: eq(plans.paddleCustomerId, paddleCustomerId),
    columns: { userId: true },
  });
  return row?.userId ?? null;
}

export async function userExists(userId: string) {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });
  return Boolean(row);
}
