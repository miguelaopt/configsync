import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPARISON, FEATURES, PRICES } from "@/lib/billing/public";
import { UpgradeButtons } from "./upgrade-buttons";

type Props = {
  viewer: { email: string; userId: string; plan: "free" | "pro" } | null;
  /** null when billing is disabled on this instance */
  prices: { monthly: string; lifetime: string } | null;
};

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2.5 text-[14px] text-ink-2">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingTable({ viewer, prices }: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section
        className="panel flex flex-col gap-5 p-6 sm:p-7"
        aria-labelledby="plan-free"
        id="free"
      >
        <div>
          <h2 id="plan-free" className="text-[20px] font-semibold text-ink">
            Free
          </h2>
          <p className="mt-1 text-[14px] text-ink-3">
            Everything you need to keep your settings safe.
          </p>
        </div>
        <p className="text-[34px] leading-none font-bold text-ink">
          0 €<span className="align-middle text-[14px] font-normal text-ink-3"> forever</span>
        </p>
        <List items={FEATURES.free} />
        <div className="mt-auto pt-2">
          {!viewer ? (
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href="/sign-up">Create a free account</Link>
            </Button>
          ) : (
            <p className="text-[13px] text-ink-3">
              {viewer.plan === "free" ? "This is your plan." : "Included with Pro."}
            </p>
          )}
        </div>
      </section>

      <section
        className="panel relative flex flex-col gap-5 border-accent/45 p-6 sm:p-7"
        aria-labelledby="plan-pro"
        id="pro"
      >
        <span className="absolute -top-3 right-6 rounded-lg bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-text ring-1 ring-accent/30">
          Everything, unlimited
        </span>
        <div>
          <h2 id="plan-pro" className="text-[20px] font-semibold text-ink">
            Pro
          </h2>
          <p className="mt-1 text-[14px] text-ink-3">
            For more than three games, more than one PC, or both.
          </p>
        </div>
        <p className="text-[34px] leading-none font-bold text-ink">
          2.99 €
          <span className="align-middle text-[14px] font-normal text-ink-3">
            {" "}
            /month · or {PRICES.lifetime}
          </span>
        </p>
        <List items={FEATURES.pro} />
        <div className="mt-auto flex flex-col gap-2 pt-2">
          {!prices ? (
            <p className="text-[13px] text-ink-3">
              This instance has billing turned off — every account is Pro.
            </p>
          ) : !viewer ? (
            <Button asChild variant="primary" size="lg" className="w-full">
              <Link href="/sign-up?next=/pricing">Sign up, then go Pro</Link>
            </Button>
          ) : viewer.plan === "pro" ? (
            <p className="text-[14px] text-ink">
              You’re on Pro. Manage it in{" "}
              <Link href="/settings#plan" className="text-accent-text hover:text-ink">
                Settings
              </Link>
              .
            </p>
          ) : (
            <UpgradeButtons email={viewer.email} userId={viewer.userId} prices={prices} />
          )}
          <p className="text-[12px] text-ink-3">
            VAT included. Cancel any time.{" "}
            <Link href="/refunds" className="text-accent-text hover:text-ink">
              14-day refund
            </Link>{" "}
            on every payment.
          </p>
        </div>
      </section>
    </div>
  );
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="size-[18px] text-good" aria-label="Included" />;
  if (value === false)
    return <Minus className="size-[18px] text-ink-3" aria-label="Not included" />;
  return <span className="text-[13px] font-medium text-ink">{value}</span>;
}

/** The long form: every capability, and exactly what each plan gets. */
export function ComparisonTable() {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[520px] text-left">
        <caption className="sr-only">What the Free and Pro plans include</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="p-4 text-[13px] font-semibold text-ink sm:p-5">
              Capability
            </th>
            <th scope="col" className="w-32 p-4 text-[13px] font-semibold text-ink sm:p-5">
              Free
            </th>
            <th scope="col" className="w-36 p-4 text-[13px] font-semibold text-accent-text sm:p-5">
              Pro
            </th>
          </tr>
        </thead>
        {COMPARISON.map((group) => (
          <tbody key={group.group}>
            <tr>
              <th
                scope="colgroup"
                colSpan={3}
                className="border-b border-line bg-raised/50 px-4 py-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase sm:px-5"
              >
                {group.group}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-b border-hairline last:border-0">
                <th scope="row" className="p-4 font-normal sm:p-5">
                  <span className="block text-[14px] font-medium text-ink">{row.label}</span>
                  {row.detail ? (
                    <span className="mt-0.5 block text-[13px] text-ink-3">{row.detail}</span>
                  ) : null}
                </th>
                <td className="p-4 sm:p-5">
                  <Cell value={row.free} />
                </td>
                <td className="p-4 sm:p-5">
                  <Cell value={row.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
