import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURES, PRICES } from "@/lib/billing/public";
import { UpgradeButtons } from "./upgrade-buttons";

type Props = {
  viewer: { email: string; userId: string; plan: "free" | "pro" } | null;
  /** null when billing is disabled on this instance */
  prices: { monthly: string; lifetime: string } | null;
};

export function PricingTable({ viewer, prices }: Props) {
  const col = "flex flex-col gap-4 rounded-md border border-line bg-surface p-6";
  const list = (items: readonly string[]) => (
    <ul className="flex flex-col gap-2 text-[13px] text-ink-2">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
          <span className={f.endsWith("(coming soon)") ? "text-ink-3" : undefined}>{f}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className={col} aria-labelledby="plan-free">
        <h2 id="plan-free" className="font-display text-xl">
          Free
        </h2>
        <p className="text-[13px] text-ink-2">Everything you need to keep your settings safe.</p>
        {list(FEATURES.free)}
        {!viewer ? (
          <Button asChild variant="secondary">
            <Link href="/sign-up">Create a free account</Link>
          </Button>
        ) : null}
      </section>
      <section className={`${col} border-accent`} aria-labelledby="plan-pro">
        <h2 id="plan-pro" className="font-display text-xl">
          Pro
        </h2>
        <p className="text-[13px] text-ink-2">
          {PRICES.monthly} · or {PRICES.lifetime}
        </p>
        {list(FEATURES.pro)}
        {!prices ? (
          <p className="text-[13px] text-ink-3">
            This instance has billing turned off — every account is Pro.
          </p>
        ) : !viewer ? (
          <Button asChild variant="primary">
            <Link href="/sign-up?next=/pricing">Sign up, then go Pro</Link>
          </Button>
        ) : viewer.plan === "pro" ? (
          <p className="text-[13px] text-ink">
            You’re on Pro. Manage it in{" "}
            <Link href="/settings#plan" className="underline underline-offset-4">
              Settings
            </Link>
            .
          </p>
        ) : (
          <UpgradeButtons email={viewer.email} userId={viewer.userId} prices={prices} />
        )}
      </section>
    </div>
  );
}
