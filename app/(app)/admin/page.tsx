import Link from "next/link";
import { Activity, CreditCard, UserPlus } from "lucide-react";
import { getAdminOverview } from "@/lib/data/admin";
import { formatMoney } from "@/lib/admin/metrics";
import { PRICES } from "@/lib/billing/public";
import { Panel } from "@/components/dashboard/panels";
import { Stat, StatGrid } from "@/components/admin/stat";
import { DayBars } from "@/components/admin/day-bars";
import { plural, timeAgo } from "@/lib/utils/format";

// ponytail: MRR = paying monthly subscriptions × the list price. A discounted or foreign-currency
// subscription is counted at list price; read each subscription's price from Paddle if that drifts.
const MONTHLY = Number.parseFloat(PRICES.monthlyAmount.replace(",", "."));
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default async function AdminOverviewPage() {
  const o = await getAdminOverview();
  const eur30 = o.revenue.d30[0];
  const eurAll = o.revenue.all[0];
  const icon = { signup: UserPlus, billing: CreditCard, device: Activity } as const;

  return (
    <div className="flex flex-col gap-6">
      <StatGrid>
        <Stat
          label="Accounts"
          value={o.users.total.toLocaleString("en")}
          detail={`+${o.users.new1} today · +${o.users.new7} this week · +${o.users.new30} in 30 days`}
        />
        <Stat
          label="Active"
          value={o.active.d7.toLocaleString("en")}
          detail={`7 days · ${o.active.d1} today · ${o.active.d30} in 30 days`}
        />
        <Stat
          label="Pro"
          value={o.plans.pro.toLocaleString("en")}
          detail={`${pct(o.conversion)} of accounts · ${o.plans.monthly} monthly · ${o.plans.lifetime} lifetime · ${o.plans.manual} granted`}
        />
        <Stat
          label="MRR"
          value={formatMoney((o.plans.monthly - o.plans.pastDue) * MONTHLY, "EUR")}
          detail={`${o.plans.pastDue} payment failing · ${o.plans.ending} canceling`}
        />
        <Stat
          label="Revenue, 30 days"
          value={eur30 ? formatMoney(eur30.gross, eur30.currency) : formatMoney(0, "EUR")}
          detail={
            eur30
              ? `${plural(eur30.sales, "sale")} · ${formatMoney(eur30.net, eur30.currency)} after tax and fees · ${formatMoney(eur30.refunded, eur30.currency)} refunded`
              : "No sales yet"
          }
        />
        <Stat
          label="Revenue, all time"
          value={eurAll ? formatMoney(eurAll.gross, eurAll.currency) : formatMoney(0, "EUR")}
          detail={
            eurAll
              ? `${plural(eurAll.sales, "sale")} · ${formatMoney(eurAll.net, eurAll.currency)} after tax and fees`
              : "No sales yet"
          }
        />
        <Stat label="PCs with the companion" value={o.devices.toLocaleString("en")} />
        <Stat
          label="Refunded, all time"
          value={formatMoney(eurAll?.refunded ?? 0, eurAll?.currency ?? "EUR")}
          detail={
            o.revenue.all.length > 1
              ? `Also sold in ${o.revenue.all
                  .slice(1)
                  .map((m) => formatMoney(m.gross, m.currency))
                  .join(", ")}`
              : undefined
          }
        />
      </StatGrid>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_420px]">
        <Panel
          icon={<UserPlus />}
          title="Sign-ups"
          subtitle="New accounts per day, last 30 days (UTC)"
          bodyClassName="px-4 pb-5 sm:px-5"
        >
          <DayBars days={o.signups} label="New accounts per day" unit="sign-ups" />
        </Panel>

        <Panel
          icon={<Activity />}
          title="Latest"
          subtitle="Sign-ups, payments and new PCs"
          bodyClassName="px-2 pb-3"
        >
          {o.activity.length === 0 ? (
            <p className="px-3 pb-3 text-[13px] text-ink-3">Nothing yet.</p>
          ) : (
            <ul className="flex flex-col">
              {o.activity.map((a, i) => {
                const Icon = icon[a.kind];
                const body = (
                  <>
                    <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{a.text}</span>
                    <span className="shrink-0 text-[12px] text-ink-3">{timeAgo(a.at)}</span>
                  </>
                );
                return (
                  <li key={i}>
                    {a.userId ? (
                      <Link
                        href={`/admin/users/${a.userId}`}
                        className="flex items-start gap-2.5 rounded-md px-3 py-2 hover:bg-raised"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2.5 px-3 py-2">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
