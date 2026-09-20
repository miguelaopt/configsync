import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getPlan } from "@/lib/billing/plan";
import { billingEnabled, env } from "@/lib/env";
import { LEGAL } from "@/lib/legal";
import { ComparisonTable, PricingTable } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing — Free and Pro plans",
  description:
    "ConfigSync pricing: free for three games, forever. Pro is 2.99 €/month or 24.99 € once — unlimited games, full settings history, auto-sync on every PC and per-PC presets.",
  alternates: { canonical: "/pricing" },
};

const FAQ = [
  {
    q: "What happens when the Free limit is reached?",
    a: "Nothing is deleted. Free keeps three active games; archive one and you can add another, and an archived game keeps every preset, setting and snapshot for the day you bring it back. Snapshots beyond the last ten per preset are the only thing Free drops, and only as new ones are made.",
  },
  {
    q: "Monthly or lifetime — which one?",
    a: "The same Pro either way. Monthly is 2.99 € and you can stop whenever you like; lifetime is 24.99 € once and covers Pro on this hosted service for as long as it runs. Lifetime pays for itself after about eight months.",
  },
  {
    q: "What happens if I cancel?",
    a: "Pro stays on until the end of the period you already paid for, then the account goes back to Free. Your games, presets and settings stay exactly where they are — you keep reading, editing and exporting all of them. Only the Pro features stop.",
  },
  {
    q: "Can I get my money back?",
    a: "Yes, within 14 days of any payment, for any reason — first month, a renewal or the lifetime licence. Ask by email and Paddle refunds the original payment method.",
  },
  {
    q: "Is the companion required?",
    a: "No. You can type settings in and copy them out by hand on the Free plan and never install anything. The companion is what reads and writes the games' own files on your PC, and it always writes a .bak copy first, never while the game is running.",
  },
  {
    q: "Which games work?",
    a: "Any game, for storing and comparing settings — you decide what the categories and rows are. Reading and writing the real config files needs the game to be in the catalog; Counter-Strike 2 and Rocket League are there and the list grows.",
  },
  {
    q: "Who handles payment?",
    a: `${LEGAL.merchant} is the merchant of record: it takes the payment, handles VAT and issues the invoice. We never see your card details.`,
  },
  {
    q: "What do you do with my data?",
    a: "Store it and show it back to you. No analytics, no trackers, no selling anything to anyone, and a full export whenever you want one.",
  },
];

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
    <div className="flex flex-col gap-14">
      <header className="max-w-2xl">
        <h1 className="text-[40px] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[52px]">
          Two plans.
          <br />
          <span className="text-accent-text">No surprises.</span>
        </h1>
        <p className="mt-5 text-[16px] text-ink-2">
          Start free and stay free for as long as three games is enough. Pro is for the moment it
          isn’t — more games, the full history of every change, and your PCs keeping themselves in
          step without you.
        </p>
      </header>

      <PricingTable viewer={viewer} prices={prices} />

      <section aria-labelledby="compare" className="flex flex-col gap-5">
        <div>
          <h2 id="compare" className="text-[26px] font-bold tracking-[-0.024em]">
            Everything, side by side
          </h2>
          <p className="mt-2 text-[14px] text-ink-3">
            Every row is something the app does today. Nothing here is a plan for later.
          </p>
        </div>
        <ComparisonTable />
      </section>

      <section aria-labelledby="honest" className="grid gap-5 md:grid-cols-3">
        <div className="md:col-span-1">
          <h2 id="honest" className="text-[26px] font-bold tracking-[-0.024em]">
            What you are paying for
          </h2>
        </div>
        <div className="grid gap-5 md:col-span-2 md:grid-cols-2">
          {[
            {
              t: "Servers and backups",
              d: "A machine in the EU, a database, and a backup taken every night. Your presets have to be there when you open the app at 2am.",
            },
            {
              t: "The screenshot importer",
              d: "Reading a settings menu off an image costs real money per image. Pro covers 30 a day, which is far more than a normal week of setup.",
            },
            {
              t: "No adverts, no tracking",
              d: "Nobody pays us for your attention or your data, so you do. That is the whole business model, and it is why there is nothing to sell about you.",
            },
            {
              t: "The work continuing",
              d: "More games in the catalog, the desktop tray app, friends and public profiles. Pro is what funds the next thing rather than the next investor.",
            },
          ].map((c) => (
            <div key={c.t} className="panel flex flex-col gap-2 p-5">
              <h3 className="text-[15px] font-semibold text-ink">{c.t}</h3>
              <p className="text-[14px] text-ink-2">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="faq" className="flex flex-col gap-5">
        <h2 id="faq" className="text-[26px] font-bold tracking-[-0.024em]">
          Questions
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="panel group p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-semibold text-ink">
                {f.q}
                <span
                  aria-hidden
                  className="mt-1 size-2.5 shrink-0 rotate-45 border-r border-b border-ink-3 transition-transform group-open:-rotate-[135deg]"
                />
              </summary>
              <p className="mt-3 text-[14px] text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="panel flex flex-col items-start gap-5 p-7 sm:p-10">
        <h2 className="max-w-xl text-[30px] leading-tight font-bold tracking-[-0.024em]">
          Save your settings once. Have them everywhere.
        </h2>
        <p className="max-w-xl text-[15px] text-ink-2">
          Free for three games, no card. Upgrade the day you want the fourth.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href={viewer ? "/dashboard" : "/sign-up"}>
              {viewer ? "Open the app" : "Create a free account"}
            </Link>
          </Button>
          {!viewer ? (
            <Button asChild variant="secondary" size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
