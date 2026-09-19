import Link from "next/link";
import type { Game } from "@/lib/db/schema";
import type { SyncLabel } from "@/lib/data/sync";
import { getCatalogGame } from "@/lib/catalog";
import { GameCover } from "@/components/games/game-cover";
import { SyncPill } from "@/components/dashboard/panels";
import { Badge } from "@/components/ui/badge";

/** The game strip above a preset: which game you are in, and how it stands overall. */
export function GameBand({
  game,
  stats,
  sync,
}: {
  game: Game;
  stats: { presets: number; settings: number; categories: number };
  sync: SyncLabel | null;
}) {
  return (
    <section className="panel flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <Link
        href={`/games/${game.slug}`}
        className="w-20 shrink-0 rounded-xl outline-offset-4"
        aria-label={`Back to ${game.name}`}
      >
        <GameCover game={game} className="[container-type:inline-size] w-full rounded-xl" />
      </Link>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[24px] leading-tight font-bold tracking-[-0.024em]">
          <Link href={`/games/${game.slug}`} className="rounded-sm hover:text-accent-text">
            {game.name}
          </Link>
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {game.platforms.map((p) => (
            <Badge key={p} variant="neutral">
              {p}
            </Badge>
          ))}
          {game.catalogId ? (
            <Badge variant="outline">
              {getCatalogGame(game.catalogId)?.name ?? game.catalogId}
            </Badge>
          ) : null}
        </div>
      </div>

      <dl className="flex shrink-0 items-center gap-6 sm:gap-8">
        {[
          { n: stats.presets, label: "Presets" },
          { n: stats.settings, label: "Settings" },
          { n: stats.categories, label: "Categories" },
        ].map((s) => (
          <div key={s.label}>
            <dt className="sr-only">{s.label}</dt>
            <dd className="tnum text-[22px] leading-none font-bold text-ink">{s.n}</dd>
            <p aria-hidden className="mt-1 text-xs text-ink-3">
              {s.label}
            </p>
          </div>
        ))}
        {sync ? (
          <div className="border-l border-line pl-6 sm:pl-8">
            <SyncPill status={sync} />
          </div>
        ) : null}
      </dl>
    </section>
  );
}
