"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { portalSessionAction } from "@/lib/actions/billing";
import type { PlanInfo } from "@/lib/billing/plan";
import { UpgradeButtons } from "@/components/billing/upgrade-buttons";

type Props = {
  info: PlanInfo;
  email: string;
  userId: string;
  prices: { monthly: string; lifetime: string } | null;
};

/** Current plan, upgrade buttons for Free, and the Paddle portal link for subscribers. */
export function PlanCard({ info, email, userId, prices }: Props) {
  const [pending, start] = React.useTransition();
  const manage = () =>
    start(async () => {
      const r = await portalSessionAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      window.location.assign(r.data.url);
    });
  const until = info.currentPeriodEnd?.toLocaleDateString();
  const sub = info.source === "subscription";
  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <p className="flex items-center gap-2 text-ink">
        <Badge variant={info.plan === "pro" ? "accent" : "outline"}>
          {info.plan === "pro" ? "Pro" : "Free"}
        </Badge>
        {info.source === "lifetime" ? "Lifetime — thank you." : null}
        {sub && info.subscriptionStatus === "canceled" && until ? `Pro until ${until}.` : null}
        {sub && info.subscriptionStatus === "active" && until ? `Renews ${until}.` : null}
        {sub && info.subscriptionStatus === "past_due"
          ? "Payment failed — update your card in the portal."
          : null}
      </p>
      {info.plan === "free" && prices ? (
        <UpgradeButtons email={email} userId={userId} prices={prices} />
      ) : null}
      {sub ? (
        <Button variant="secondary" onClick={manage} loading={pending} className="self-start">
          Manage subscription
        </Button>
      ) : null}
      <p className="text-ink-3">
        Compare plans on the{" "}
        <Link href="/pricing" className="underline underline-offset-4 hover:text-ink">
          pricing page
        </Link>
        .
      </p>
    </div>
  );
}
