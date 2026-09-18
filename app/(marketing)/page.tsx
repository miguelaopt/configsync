import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { FEATURES, PRICES } from "@/lib/billing/public";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: `${SITE.name} — ${SITE.tagline}` };

const POINTS: { title: string; body: string }[] = [
  {
    title: "Any game, real menus",
    body: "Add any title and type its settings in an interface that feels like the game's own menu. Counter-Strike 2 and Rocket League come with their actual menus and options.",
  },
  {
    title: "Presets, history, compare",
    body: "Main, Competitive, Laptop — keep several setups per game, diff them side by side, restore any earlier snapshot, copy or export everything as text, Markdown, CSV or JSON.",
  },
  {
    title: "Your PC follows the vault",
    body: "The csync companion reads a game's config files into a preset and writes presets back with a backup. Pro keeps every PC in sync automatically and lets each PC run its own preset.",
  },
  {
    title: "Share what works",
    body: "Publish a profile with your presets and links. Visitors copy, download, or save a preset straight into their own vault.",
  },
];

/** Placeholder landing page: signed-in users go to the dashboard, everyone else reads this. */
export default async function HomePage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="flex flex-col gap-14 py-6 sm:py-10">
      <section className="flex flex-col items-start gap-5">
        <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">{SITE.tagline}</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-ink-2">
          Save, organise, compare and export the settings you use for any game — sensitivity,
          keybinds, graphics, audio, whatever the game has. Works on phone and desktop. No game
          integration required: you keep the values, the vault keeps them safe.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary" size="lg">
            <Link href="/sign-up">Create a free account</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        {POINTS.map((p) => (
          <div key={p.title} className="rounded-sm border border-line p-5">
            <h2 className="font-display text-lg text-ink">{p.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-sm border border-line p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-ink">Free and Pro</h2>
          <p className="text-[13px] text-ink-2">
            Pro is {PRICES.monthly} or {PRICES.lifetime}. Free is free forever.
          </p>
        </div>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          {(["free", "pro"] as const).map((plan) => (
            <div key={plan}>
              <h3 className="text-sm font-medium text-ink">{plan === "free" ? "Free" : "Pro"}</h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
                {FEATURES[plan].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <Button asChild variant="secondary">
            <Link href="/pricing">See plans and buy Pro</Link>
          </Button>
        </div>
      </section>

      <p className="text-xs text-ink-3">
        The web app stores and copies your settings; only the companion, run by you on your own PC,
        ever touches a game’s files. Payments are handled by Paddle, our merchant of record.
      </p>
    </div>
  );
}
