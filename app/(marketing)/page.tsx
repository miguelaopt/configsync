import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PRICES } from "@/lib/billing/public";
import { LEGAL } from "@/lib/legal";
import { Button } from "@/components/ui/button";
import { HeroDemo } from "@/components/marketing/hero-demo";
import {
  Breakout,
  Group,
  Panel,
  PanelBar,
  Row,
  RowAction,
  Status,
  Val,
} from "@/components/marketing/menu";

export const metadata: Metadata = {
  title: { absolute: "Your game settings. One place." },
  description:
    "Save the settings you use for any game, keep presets per game, compare two, sync every PC, restore any save.",
};

/** Landing page, direction A: the app's own options-menu grammar at every scale. */
export default async function HomePage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="flex flex-col gap-24 py-8 sm:py-14">
      {/* Hero ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-8">
        <div className="flex max-w-[640px] flex-col gap-5">
          <h1 className="font-display text-[31px] leading-[1.08] font-semibold tracking-tight text-ink sm:text-[44px]">
            Your settings. Every game. Every PC.
          </h1>
          <p className="text-[16px] leading-[1.55] text-ink-2 sm:text-[18px]">
            Save them once. Keep presets per game, compare two, sync every PC, restore any save.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/sign-up">Create a free account</Link>
            </Button>
            <Button asChild variant="link" size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
          <p className="text-[13px] text-ink-3">Free: 3 games, the companion, a public profile.</p>
        </div>
        <Breakout>
          <HeroDemo />
        </Breakout>
        <p className="max-w-[640px] text-[13px] text-ink-3">
          This is the real menu. Switch the game, switch the preset, change a value — the status
          shows what every PC running the companion does next.
        </p>
      </section>

      {/* Presets and history ------------------------------------------------------ */}
      <Section
        id="presets"
        title="Presets and history"
        lead="Several setups per game. Every save is a snapshot you can go back to."
      >
        <Panel>
          <PanelBar>
            <span className="font-display text-[16px] font-medium">Counter-Strike 2</span>
            <span className="text-[13px] text-ink-3">3 presets</span>
          </PanelBar>
          <Row label="Main">
            <span className="text-[13px] text-ink-3">Default</span>
            <RowAction className="hidden sm:inline-flex">Duplicate</RowAction>
            <RowAction className="hidden sm:inline-flex">Archive</RowAction>
          </Row>
          <Row label="Competitive">
            <RowAction>Set as default</RowAction>
            <RowAction className="hidden sm:inline-flex">Duplicate</RowAction>
            <RowAction className="hidden sm:inline-flex">Archive</RowAction>
          </Row>
          <Row label="Laptop">
            <RowAction>Set as default</RowAction>
            <RowAction className="hidden sm:inline-flex">Duplicate</RowAction>
            <RowAction className="hidden sm:inline-flex">Archive</RowAction>
          </Row>
          <Group>History of Main</Group>
          <Row label={<Muted when="Today, 18:42">Sensitivity 1.80 → 1.85</Muted>}>
            <RowAction>Restore</RowAction>
          </Row>
          <Row label={<Muted when="Yesterday">Refresh rate 144 Hz → 240 Hz</Muted>}>
            <RowAction>Restore</RowAction>
          </Row>
          <Row label={<Muted when="Monday">Imported from the companion</Muted>}>
            <RowAction>Restore</RowAction>
          </Row>
        </Panel>
      </Section>

      {/* Compare ------------------------------------------------------------------ */}
      <Section
        id="compare"
        title="Compare two presets"
        lead="Exactly what differs. Identical rows step back."
      >
        <Panel>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 border-b border-line px-4 py-2 text-[13px] text-ink-3">
            <span>Setting</span>
            <span className="min-w-20 text-right font-display text-[16px] font-medium text-ink sm:min-w-28">
              Main
            </span>
            <span className="min-w-20 text-right font-display text-[16px] font-medium text-ink sm:min-w-28">
              Laptop
            </span>
          </div>
          <CompareRow label="Sensitivity" a="1.85" b="2.10" changed />
          <CompareRow label="Resolution" a="1920 × 1080" b="1600 × 900" changed />
          <CompareRow label="Refresh rate" a="240 Hz" b="144 Hz" changed />
          <CompareRow label="DPI" a="800" b="800" />
          <CompareRow label="Raw input" a="On" b="On" />
          <CompareRow label="Jump" a="Space" b="Space" />
        </Panel>
      </Section>

      {/* Sync ---------------------------------------------------------------------- */}
      <Section
        id="sync"
        title="Every PC follows the vault"
        lead="The companion runs on your PC. It reads a game's files into a preset and writes presets back — with a backup first."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel>
            <PanelBar>
              <span className="font-display text-[16px] font-medium">Desktop</span>
              <span className="ml-auto">
                <Status state="synced" />
              </span>
            </PanelBar>
            <Row label="Sensitivity">
              <Val>1.85</Val>
            </Row>
            <Row label="Refresh rate">
              <Val unit="Hz">240</Val>
            </Row>
          </Panel>
          <Panel>
            <PanelBar>
              <span className="font-display text-[16px] font-medium">Laptop</span>
              <span className="ml-auto">
                <Status state="syncing" />
              </span>
            </PanelBar>
            <Row label="Sensitivity">
              <Val>1.85</Val>
            </Row>
            <Row label="Refresh rate">
              <Val unit="Hz">144</Val>
            </Row>
          </Panel>
        </div>
        <Panel className="mt-4">
          <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-[1.7] text-ink-2">
            <span className="text-ink-3">$</span> csync import cs2{"\n"}
            Created preset: configsync.app/games/counter-strike-2/imported-from-desktop{"\n"}
            <span className="text-ink-3">$</span> csync watch{"\n"}
            <span className="text-ink-3">18:42:07</span> applied &quot;Main&quot; to Counter-Strike
            2{"\n"}
            <span className="text-ink-3">18:42:07</span> backup written:
            cs2_video.txt.bak-2026-09-18
          </pre>
        </Panel>
        <p className="mt-4 max-w-[640px] text-[15px] text-ink-2">
          Pro adds auto-switch — <code className="font-mono text-[13px]">csync watch</code> keeps
          every PC&apos;s files equal to the chosen preset while the game is closed — and per-PC
          presets: choose what each PC runs and see what is applied where.
        </p>
      </Section>

      {/* Catalog ------------------------------------------------------------------- */}
      <Section
        id="catalog"
        title="Real menus, and any game"
        lead="Catalog games come with their actual settings menu, names and options. Everything else you add yourself — nothing is hard-coded."
      >
        <Panel>
          <Row label="Counter-Strike 2">
            <span className="text-[13px] text-ink-2">Real menu, config files read and written</span>
          </Row>
          <Row label="Rocket League">
            <span className="text-[13px] text-ink-2">Real menu, config files read and written</span>
          </Row>
          <Row label="Your game">
            <span className="text-[13px] text-ink-2">Any title, your categories, your values</span>
          </Row>
        </Panel>
      </Section>

      {/* Share --------------------------------------------------------------------- */}
      <Section
        id="share"
        title="Share what works"
        lead="A public page with your presets and links. Visitors copy, download, or save a preset into their own vault."
      >
        <Panel>
          <PanelBar>
            <span className="font-mono text-[13px] text-ink-2">configsync.app/p/you</span>
            <span className="ml-auto flex gap-3 text-[13px] text-ink-3">
              <span>Twitch</span>
              <span>YouTube</span>
            </span>
          </PanelBar>
          <Row label="Counter-Strike 2 — Main">
            <RowAction className="hidden sm:inline-flex">Copy preset</RowAction>
            <RowAction className="hidden sm:inline-flex">Download JSON</RowAction>
            <RowAction>Save to my vault</RowAction>
          </Row>
          <Row label="Rocket League — Main">
            <RowAction className="hidden sm:inline-flex">Copy preset</RowAction>
            <RowAction className="hidden sm:inline-flex">Download JSON</RowAction>
            <RowAction>Save to my vault</RowAction>
          </Row>
        </Panel>
      </Section>

      {/* Export -------------------------------------------------------------------- */}
      <Section
        id="export"
        title="Copy or export anything"
        lead="One setting, a category or a whole preset — as text, Markdown, CSV or JSON. Import it back any time."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <PanelBar>
              <span className="text-[13px] text-ink-3">Text</span>
            </PanelBar>
            <pre className="px-4 py-3 font-mono text-[13px] leading-[1.7] text-ink-2">
              Sensitivity: 1.85{"\n"}DPI: 800{"\n"}Raw input: On
            </pre>
          </Panel>
          <Panel>
            <PanelBar>
              <span className="text-[13px] text-ink-3">Markdown</span>
            </PanelBar>
            <pre className="px-4 py-3 font-mono text-[13px] leading-[1.7] text-ink-2">
              | Mouse | |{"\n"}|---|---|{"\n"}| Sensitivity | 1.85 |
            </pre>
          </Panel>
          <Panel>
            <PanelBar>
              <span className="text-[13px] text-ink-3">JSON</span>
            </PanelBar>
            <pre className="px-4 py-3 font-mono text-[13px] leading-[1.7] text-ink-2">
              {'{ "name": "Sensitivity",\n  "type": "decimal",\n  "value": 1.85 }'}
            </pre>
          </Panel>
        </div>
      </Section>

      {/* Plans --------------------------------------------------------------------- */}
      <Section id="plans" title="Free and Pro" lead="Free is free. Pro pays for the servers.">
        <Panel>
          <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-5">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[20px] font-semibold">Free</span>
                <Val>0 €</Val>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 text-[15px] text-ink-2">
                <li>3 active games</li>
                <li>10 snapshots per preset</li>
                <li>The companion: import and apply</li>
                <li>Public profile</li>
              </ul>
            </div>
            <div className="p-5">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[20px] font-semibold">Pro</span>
                <span className="font-mono text-[15px]">
                  {PRICES.monthly} <span className="text-ink-3">or</span> {PRICES.lifetime}
                </span>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 text-[15px] text-ink-2">
                <li>Unlimited games and history</li>
                <li>Auto-switch on every PC</li>
                <li>Per-PC presets</li>
                <li>AI screenshot importer</li>
              </ul>
            </div>
          </div>
        </Panel>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button asChild variant="primary">
            <Link href="/sign-up">Create a free account</Link>
          </Button>
          <Button asChild variant="link">
            <Link href="/pricing">See plans</Link>
          </Button>
        </div>
      </Section>

      {/* Privacy ------------------------------------------------------------------- */}
      <Section id="privacy" title="Your data" lead="What touches what.">
        <ul className="flex max-w-[640px] flex-col gap-2 text-[15px] leading-[1.55] text-ink-2">
          <li>The web app stores and copies your settings. It never touches a game.</li>
          <li>Only the companion, run by you on your own PC, reads or writes game files.</li>
          <li>No analytics, no trackers. Export everything, any time.</li>
          <li>Payments are handled by Paddle, the merchant of record.</li>
        </ul>
      </Section>

      {/* Final CTA ------------------------------------------------------------------ */}
      <section className="flex max-w-[640px] flex-col gap-5">
        <h2 className="font-display text-[25px] font-semibold tracking-tight text-ink sm:text-[31px]">
          Save your settings once.
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href="/sign-up">Create a free account</Link>
          </Button>
          <span className="text-[13px] text-ink-3">
            Free: 3 games, the companion, a public profile.
          </span>
        </div>
        <p className="text-[13px] text-ink-3">
          Questions:{" "}
          <a href={`mailto:${LEGAL.email}`} className="text-ink-2 underline underline-offset-4">
            {LEGAL.email}
          </a>
        </p>
      </section>
    </div>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-6">
      <div className="flex max-w-[640px] flex-col gap-2">
        <h2 className="font-display text-[25px] font-semibold tracking-tight text-ink sm:text-[31px]">
          {title}
        </h2>
        <p className="text-[16px] leading-[1.55] text-ink-2">{lead}</p>
      </div>
      <Breakout>{children}</Breakout>
    </section>
  );
}

function Muted({ when, children }: { when: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="font-mono text-[13px] font-normal text-ink-3">{when}</span>
      <span className="font-sans text-[15px] font-normal text-ink">{children}</span>
    </span>
  );
}

function CompareRow({
  label,
  a,
  b,
  changed,
}: {
  label: string;
  a: string;
  b: string;
  changed?: boolean;
}) {
  return (
    <div
      data-active={changed || undefined}
      className="menu-row grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 px-4"
    >
      <span
        className={`font-display text-[16px] font-medium ${changed ? "text-ink" : "text-ink-3"}`}
      >
        {label}
      </span>
      <Val
        className={`min-w-20 text-right text-[13px] whitespace-nowrap sm:min-w-28 sm:text-[15px] ${changed ? "" : "text-ink-3"}`}
      >
        {a}
      </Val>
      <Val
        className={`min-w-20 text-right text-[13px] whitespace-nowrap sm:min-w-28 sm:text-[15px] ${changed ? "text-accent-text" : "text-ink-3"}`}
      >
        {b}
      </Val>
    </div>
  );
}
