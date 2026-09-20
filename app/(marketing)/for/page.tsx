import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { CATALOG } from "@/lib/catalog";
import { GameCover } from "@/components/games/game-cover";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Games with a real settings menu — CS2, Rocket League and more",
  description:
    "The games ConfigSync ships with their actual settings menu and config files: Counter-Strike 2 and Rocket League today. Any other game can be added by hand.",
  alternates: { canonical: "/for" },
};

/** Index of the catalog: one card per game, each linking to its own page. */
export default function GamesIndexPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-2xl">
        <h1 className="text-[40px] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[52px]">
          Built around
          <br />
          <span className="text-accent-text">the games you play.</span>
        </h1>
        <p className="mt-5 text-[16px] text-ink-2">
          These games come with their real menu and the companion knows their files. Everything else
          you add yourself, with the settings you care about.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {CATALOG.map((g) => {
          const categories = g.presets[0]!.categories;
          const settings = categories.reduce((n, c) => n + c.settings.length, 0);
          return (
            <li key={g.id}>
              <Link
                href={`/for/${g.id}`}
                className="panel group flex gap-5 p-5 transition-colors hover:border-line-strong"
                style={{ "--accent": g.accentColor ?? undefined } as React.CSSProperties}
              >
                <GameCover
                  game={{
                    name: g.name,
                    accentColor: g.accentColor ?? null,
                    coverAttachmentId: null,
                    coverUrl: g.coverUrl ?? null,
                  }}
                  className="w-24 shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-[-0.02em] text-ink">
                    {g.name}
                    <ArrowRight
                      className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </h2>
                  <p className="mt-1 text-[13px] text-ink-3">
                    {plural(settings, "setting")} · {g.files.length} config files ·{" "}
                    {g.epicAppName ? "Steam, Epic, Heroic" : "Steam"}
                  </p>
                  <p className="mt-3 text-[14px] text-ink-2">
                    {categories.map((c) => c.name).join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/sign-up"
            className="panel flex h-full gap-5 border-dashed p-5 transition-colors hover:border-line-strong"
          >
            <span
              aria-hidden
              className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-raised text-ink-3"
            >
              <Plus className="size-8" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink">Any other game</h2>
              <p className="mt-3 text-[14px] text-ink-2">
                Add the game, name the settings, keep presets the same way. The companion is for
                catalog games; everything else is yours to type or paste.
              </p>
            </div>
          </Link>
        </li>
      </ul>
    </div>
  );
}
