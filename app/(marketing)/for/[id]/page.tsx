import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOG, getCatalogGame, type CatalogGame } from "@/lib/catalog";
import { SITE } from "@/lib/site";
import { FOUNDER, PRICES } from "@/lib/billing/public";
import { founderOfferEnabled } from "@/lib/env";
import { GameCover } from "@/components/games/game-cover";
import { Faq } from "@/components/marketing/faq";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/utils/format";
import type { Params } from "@/lib/types";

export const dynamicParams = false;
export function generateStaticParams() {
  return CATALOG.map((g) => ({ id: g.id }));
}

const PLATFORM: Record<string, string> = {
  "steam-linux": "Steam · Linux",
  "steam-windows": "Steam · Windows",
  "epic-linux": "Epic / Heroic · Linux",
  "epic-windows": "Epic · Windows",
};

type CatalogSetting = CatalogGame["presets"][number]["categories"][number]["settings"][number];

/** The config key a setting maps to, when it is a single key (resolution and keybinds are not). */
const sourceKey = (source: CatalogSetting["source"]) =>
  source && "key" in source ? source.key : source && "bind" in source ? source.bind : null;

const summary = (id: string) => {
  const g = getCatalogGame(id);
  if (!g) return null;
  const categories = g.presets[0]!.categories;
  const settings = categories.reduce((n, c) => n + c.settings.length, 0);
  // The file's own name, e.g. cs2_video.txt — the same on every platform, so any path will do.
  const files = g.files.flatMap((f) => {
    const first = Object.values(f.paths).find(Boolean);
    return first ? [first.split("/").pop()!] : [];
  });
  return { g, categories, settings, files };
};

export async function generateMetadata({ params }: { params: Params<"id"> }): Promise<Metadata> {
  const s = summary((await params).id);
  if (!s) return {};
  const { g, categories, settings, files } = s;
  const short = g.name.replace("Counter-Strike 2", "CS2");
  return {
    title: `${g.name} settings — save, sync and share your ${short} config`,
    description: `Keep your ${g.name} settings in ConfigSync: ${categories.map((c) => c.name.toLowerCase()).join(", ")} — ${settings} settings read straight from ${files.join(", ")}. Presets per situation, every change kept, and every PC on the setup you chose.`,
    alternates: { canonical: `/for/${g.id}` },
    openGraph: { images: g.coverUrl ? [g.coverUrl] : undefined },
  };
}

/** One public page per catalog game: what the catalog knows, which files the companion reads. */
export default async function GamePage({ params }: { params: Params<"id"> }) {
  const s = summary((await params).id);
  if (!s) notFound();
  const { g, categories, settings, files } = s;
  const short = g.name.replace("Counter-Strike 2", "CS2");
  const launcher = g.epicAppName ? "Steam, Epic or Heroic" : "Steam";
  const cover = {
    name: g.name,
    accentColor: g.accentColor ?? null,
    coverAttachmentId: null,
    coverUrl: g.coverUrl ?? null,
  };

  const faq = [
    {
      q: `Does ConfigSync change ${short}'s files while the game is running?`,
      a: `No. ${g.name} reads its config at start-up and rewrites it on exit, so the companion only applies a preset while the game is closed — it waits and applies as soon as the process (${g.processNames.join(", ")}) is gone. Every file is backed up next to itself first.`,
    },
    {
      q: `Which ${short} files does it read?`,
      a: `${files.join(", ")} — the files ${g.name} itself writes. Only the keys ConfigSync knows are touched; everything else in the file is kept byte for byte.`,
    },
    {
      q: "Is it free?",
      a: `Yes: Free keeps three games with ten snapshots per preset, and the companion is included. Pro (${PRICES.monthly} or ${
        founderOfferEnabled ? `${FOUNDER.lifetime} while ConfigSync is in alpha` : PRICES.lifetime
      }) adds unlimited games, the full history and automatic sync of every PC.`,
    },
    {
      q: "What about Steam Cloud?",
      a: `Steam Cloud can restore an older file when the game launches. If a change disappears, turn Cloud sync off for ${g.name} and apply the preset again.`,
    },
  ];

  return (
    <div className="flex flex-col gap-14">
      <nav aria-label="Breadcrumb" className="-mb-8 text-[13px] text-ink-3">
        <Link href="/for" className="rounded-sm hover:text-ink">
          Games
        </Link>
        <span aria-hidden className="px-2">
          ›
        </span>
        <span className="text-ink-2">{g.name}</span>
      </nav>

      <header
        className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8"
        style={{ "--accent": g.accentColor ?? undefined } as React.CSSProperties}
      >
        <GameCover game={cover} className="w-36 shrink-0 rounded-2xl sm:w-44" />
        <div className="max-w-2xl min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {g.tags.map((t) => (
              <Badge key={t} variant="neutral">
                {t}
              </Badge>
            ))}
          </div>
          <h1 className="mt-3 text-[40px] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[52px]">
            {g.name} settings,
            <br />
            <span className="text-accent-text">saved and synced.</span>
          </h1>
          <p className="mt-5 text-[16px] text-ink-2">
            ConfigSync ships {g.name}&rsquo;s real menu — {settings} settings across{" "}
            {categories.map((c) => c.name.toLowerCase()).join(", ")} — and a companion that reads
            them from the game&rsquo;s own files on {launcher}. Keep a preset for every situation,
            see what changed, and put the one you want on any PC.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/sign-up">Create a free account</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/docs/companion">Install the companion</Link>
            </Button>
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [settings, "settings"],
          [categories.length, "categories"],
          [g.files.length, "config files"],
          [Object.keys(g.files[0]?.paths ?? {}).length, "platforms"],
        ].map(([n, label]) => (
          <div key={label} className="panel px-5 py-4">
            <dd className="tnum text-[28px] leading-none font-bold text-ink">{n}</dd>
            <dt className="mt-1.5 text-[13px] text-ink-3">{label}</dt>
          </div>
        ))}
      </dl>

      <section aria-labelledby="covers" className="flex flex-col gap-5">
        <div>
          <h2 id="covers" className="text-[26px] font-bold tracking-[-0.024em]">
            Every {short} setting, by name
          </h2>
          <p className="mt-2 text-[14px] text-ink-3">
            The menu as the game shows it, with the config key underneath — so what you save is what
            the game reads.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((c) => (
            <section key={c.name} className="panel p-5">
              <h3 className="flex items-baseline justify-between gap-3 text-[15px] font-semibold text-ink">
                {c.name}
                <span className="tnum text-[13px] font-normal text-ink-3">
                  {plural(c.settings.length, "setting")}
                </span>
              </h3>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                {c.settings.map((st) => (
                  <li key={st.name} className="flex items-baseline gap-1.5">
                    <span className="text-ink-2">{st.name}</span>
                    {sourceKey(st.source) ? (
                      <code className="font-mono text-[11px] text-ink-3">
                        {sourceKey(st.source)}
                      </code>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="files" className="flex flex-col gap-5">
        <div>
          <h2 id="files" className="text-[26px] font-bold tracking-[-0.024em]">
            The files the companion reads and writes
          </h2>
          <p className="mt-2 text-[14px] text-ink-3">
            Where {g.name} keeps its config on each launcher. The companion finds them itself; you
            never type a path.
          </p>
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-ink-3 uppercase">
                <th className="px-5 py-3 font-semibold">File</th>
                <th className="px-5 py-3 font-semibold">Format</th>
                <th className="px-5 py-3 font-semibold">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {g.files.map((f) => (
                <tr key={f.id} className="align-top">
                  <td className="px-5 py-3 font-medium text-ink capitalize">{f.id}</td>
                  <td className="px-5 py-3 text-ink-2">
                    {f.format === "ini" ? "INI" : "KeyValues"}
                  </td>
                  <td className="px-5 py-3">
                    <ul className="flex flex-col gap-1.5">
                      {Object.entries(f.paths).map(([platform, path]) => (
                        <li key={platform} className="flex flex-wrap gap-x-3">
                          <span className="w-40 shrink-0 text-ink-3">
                            {PLATFORM[platform] ?? platform}
                          </span>
                          <code className="font-mono text-[12px] text-ink-2">{path}</code>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="how" className="flex flex-col gap-5">
        <h2 id="how" className="text-[26px] font-bold tracking-[-0.024em]">
          Three commands
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            {
              t: `Add ${g.name}`,
              d: "From the catalog, in the app. You get the Default preset with the real menu.",
              c: null,
            },
            {
              t: "Import what your PC has",
              d: "The companion reads the files above into a new preset. Nothing is overwritten.",
              c: `csync import ${g.id}`,
            },
            {
              t: "Apply before you play",
              d: `Put it in ${g.name}'s launch options and the right preset is in place every time.`,
              c: `csync launch ${g.id} -- %command%`,
            },
          ].map((step, i) => (
            <li key={step.t} className="panel flex flex-col gap-2 p-5">
              <span className="tnum text-[12px] font-semibold text-accent-text">0{i + 1}</span>
              <h3 className="text-[15px] font-semibold text-ink">{step.t}</h3>
              <p className="text-[14px] text-ink-2">{step.d}</p>
              {step.c ? (
                <code className="mt-auto block rounded-lg bg-raised px-3 py-2 font-mono text-[12px] text-ink">
                  {step.c}
                </code>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq" className="flex flex-col gap-5">
        <h2 id="faq" className="text-[26px] font-bold tracking-[-0.024em]">
          Questions about {short}
        </h2>
        <Faq items={faq} />
      </section>

      <section className="panel flex flex-col items-start gap-5 p-7 sm:p-10">
        <h2 className="max-w-xl text-[30px] leading-tight font-bold tracking-[-0.024em]">
          Your {short} setup, on every PC you play on.
        </h2>
        <p className="max-w-xl text-[15px] text-ink-2">
          Free for three games, no card. {SITE.name} keeps a snapshot of every change.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href="/sign-up">Create a free account</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
