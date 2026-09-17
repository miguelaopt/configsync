import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getPlan } from "@/lib/billing/plan";
import { billingEnabled, env } from "@/lib/env";
import { PricingTable } from "@/components/billing/pricing-table";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const session = await getSession();
  const viewer = session
    ? {
        email: session.user.email,
        userId: session.user.id,
        plan: (await getPlan(session.user.id)).plan,
      }
    : null;
  const prices =
    billingEnabled && env.PADDLE_PRICE_MONTHLY && env.PADDLE_PRICE_LIFETIME
      ? { monthly: env.PADDLE_PRICE_MONTHLY, lifetime: env.PADDLE_PRICE_LIFETIME }
      : null;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl">Plans</h1>
        <p className="mt-2 text-[13px] text-ink-2">
          Free is free forever. Pro pays for the servers and the AI.
        </p>
      </div>
      <PricingTable viewer={viewer} prices={prices} />
    </div>
  );
}
