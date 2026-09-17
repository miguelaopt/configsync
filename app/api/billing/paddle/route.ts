import { NextResponse } from "next/server";
import { billingEnabled, env } from "@/lib/env";
import { applyPaddleEvent, paddleEventSchema, verifyPaddleSignature } from "@/lib/billing/paddle";
import {
  findUserIdByCustomer,
  getPlanRow,
  recordBillingEvent,
  upsertPlanRow,
  userExists,
} from "@/lib/data/billing";

/** Paddle → us. Verified, idempotent, and the only writer of `plans`. */
export async function POST(req: Request) {
  if (!billingEnabled) return NextResponse.json({ error: "Billing is off." }, { status: 404 });
  const raw = await req.text();
  if (!verifyPaddleSignature(raw, req.headers.get("paddle-signature"), env.PADDLE_WEBHOOK_SECRET!))
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }
  const parsed = paddleEventSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "Unexpected event shape." }, { status: 400 });
  const event = parsed.data;

  const fromCustomData = event.data.custom_data?.userId;
  const userId =
    (fromCustomData && (await userExists(fromCustomData)) ? fromCustomData : null) ??
    (event.data.customer_id ? await findUserIdByCustomer(event.data.customer_id) : null);

  const fresh = await recordBillingEvent({
    event_id: event.event_id,
    event_type: event.event_type,
    userId,
    payload: json,
  });
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });
  if (!userId) {
    console.warn("[csync:billing] no user for event", event.event_id, event.event_type);
    return NextResponse.json({ ok: true, unmatched: true });
  }

  const next = applyPaddleEvent(
    await getPlanRow(userId),
    event,
    userId,
    env.PADDLE_PRICE_LIFETIME ?? "",
  );
  if (next) await upsertPlanRow(next);
  return NextResponse.json({ ok: true });
}
