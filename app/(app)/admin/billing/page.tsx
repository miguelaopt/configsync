import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Receipt } from "lucide-react";
import { getAdminBilling, ADMIN_PAGE_SIZE } from "@/lib/data/admin";
import { Panel } from "@/components/dashboard/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { Pager, pageParam } from "@/components/admin/pager";
import { cn } from "@/lib/utils/cn";
import type { SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Billing" };

const when = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) : "—";

const STATUS_TONE: Record<string, "good" | "bad" | "note" | "neutral"> = {
  active: "good",
  trialing: "good",
  past_due: "bad",
  paused: "note",
  canceled: "neutral",
};

export default async function AdminBillingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const type = typeof params.type === "string" ? params.type : "";
  const page = pageParam(params.page);
  const b = await getAdminBilling({ type, page });

  return (
    <div className="flex flex-col gap-6">
      <Panel
        icon={<CreditCard />}
        title="Plans"
        subtitle={`${b.plans.length} accounts have paid or been granted Pro`}
        bodyClassName="px-0 pb-2"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b border-line text-ink-3">
              <tr>
                <th className="px-5 py-2 font-medium">Account</th>
                <th className="px-5 py-2 font-medium">Now</th>
                <th className="px-5 py-2 font-medium">Source</th>
                <th className="px-5 py-2 font-medium">Subscription</th>
                <th className="px-5 py-2 font-medium">Period ends</th>
                <th className="px-5 py-2 font-medium">Paddle</th>
              </tr>
            </thead>
            <tbody>
              {b.plans.map((p) => (
                <tr key={p.userId} className="border-b border-line last:border-0">
                  <td className="px-5 py-2">
                    <Link
                      href={`/admin/users/${p.userId}`}
                      className="text-ink hover:text-accent-text"
                    >
                      {p.email}
                    </Link>
                  </td>
                  <td className="px-5 py-2">
                    {p.plan === "pro" ? <Badge variant="good">Pro</Badge> : <Badge>Free</Badge>}
                  </td>
                  <td className="px-5 py-2 text-ink-2">
                    {p.source === "manual" ? "granted" : p.source}
                  </td>
                  <td className="px-5 py-2">
                    {p.subscriptionStatus ? (
                      <Badge variant={STATUS_TONE[p.subscriptionStatus] ?? "neutral"}>
                        {p.subscriptionStatus}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-2 text-ink-2">{when(p.currentPeriodEnd)}</td>
                  <td className="px-5 py-2 text-[12px] text-ink-3">
                    <code>{p.paddleSubscriptionId ?? p.paddleCustomerId ?? "—"}</code>
                  </td>
                </tr>
              ))}
              {b.plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-ink-3">
                    Nobody yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        icon={<Receipt />}
        title="Paddle webhooks"
        subtitle={`${b.total.toLocaleString("en")} events received, each stored once`}
      >
        <form action="/admin/billing" className="mb-3 flex flex-wrap items-center gap-2">
          <select
            name="type"
            defaultValue={type}
            aria-label="Event type"
            className={cn(inputClass, "w-64")}
          >
            <option value="">Every event</option>
            {["transaction", "subscription", "adjustment"].map((g) => (
              <option key={g} value={`${g}.`}>
                {g}.*
              </option>
            ))}
            {b.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            Filter
          </Button>
        </form>
        {b.events.length === 0 ? (
          <p className="text-[13px] text-ink-3">No events.</p>
        ) : (
          <ul className="flex flex-col">
            {b.events.map((e) => (
              <li key={e.id} className="border-b border-line py-2 text-[13px] last:border-0">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-ink">
                      {e.type}{" "}
                      {e.userId ? (
                        <span className="text-ink-3">· {e.email ?? "deleted account"}</span>
                      ) : (
                        <span className="text-bad">· no account matched</span>
                      )}
                    </span>
                    <span className="text-[12px] text-ink-3">{when(e.at)} UTC</span>
                  </summary>
                  <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-ground p-3 text-[11px] text-ink-3">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Pager
            page={page}
            total={b.total}
            size={ADMIN_PAGE_SIZE}
            href={(p) => `/admin/billing?${new URLSearchParams({ type, page: String(p) })}`}
          />
        </div>
      </Panel>
    </div>
  );
}
