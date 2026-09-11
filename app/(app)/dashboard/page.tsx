import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Download, Layers, Search, Star, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { Page, SectionTitle } from "@/components/app/page-header";
import { GameCover } from "@/components/games/game-cover";
import { NewGameButton } from "@/components/games/new-game-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { plural, timeAgo } from "@/lib/utils/format";
import { SearchTrigger } from "@/components/dashboard/search-trigger";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);
  const firstName = user.name.split(" ")[0] || "there";
  const empty = data.totals.games === 0;

  return (
    <Page size="xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[28px]">Hi {firstName}.</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            {empty
              ? "Your vault is empty. Add a game or import a file to get started."
              : `${plural(data.totals.games, "game")}, ${plural(data.totals.presets, "preset")}, ${plural(data.totals.settings, "setting")} saved.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewGameButton />
          <Button asChild variant="secondary">
            <Link href="/import">
              <Upload /> Import
            </Link>
          </Button>
        </div>
      </div>

      <SearchTrigger />

      {empty ? (
        <EmptyState
          className="mt-6"
          icon={<Layers />}
          title="Start your vault"
          description="Add a game, create a preset like “Main Setup”, then add categories and settings that mirror the game's own menu."
          action={
            <>
              <NewGameButton />
              <Button asChild variant="secondary">
                <Link href="/import">Import a JSON file</Link>
              </Button>
            </>
          }
        />
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-10">
            {data.recentGames.length > 0 ? (
              <section aria-labelledby="recent-games">
                <SectionTitle
                  action={
                    <Link href="/games" className="text-[13px] text-ink-2 hover:text-ink">
                      All games
                    </Link>
                  }
                >
                  <span id="recent-games">Continue</span>
                </SectionTitle>
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {data.recentGames.map((g) => (
                    <li key={g.id}>
                      <Link href={`/games/${g.slug}`} className="block rounded-md outline-offset-4">
                        <GameCover game={g} className="[container-type:inline-size] w-full" />
                        <span className="mt-1.5 block truncate text-[13px] font-medium">
                          {g.name}
                        </span>
                        <span className="block truncate text-xs text-ink-3">
                          <Clock className="mr-1 inline size-3 align-[-1px]" aria-hidden />
                          {timeAgo(g.lastOpenedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="recent-presets">
              <SectionTitle>
                <span id="recent-presets">Recently edited presets</span>
              </SectionTitle>
              {data.recentPresets.length === 0 ? (
                <p className="text-[13px] text-ink-3">Presets you edit will show up here.</p>
              ) : (
                <ul className="divide-y divide-hairline border-y border-hairline">
                  {data.recentPresets.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/games/${p.gameSlug}/${p.slug}`}
                        className="menu-row flex items-center gap-3 px-3 py-2 outline-offset-[-2px]"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: p.accentColor ?? "var(--accent)" }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-ink">
                              {p.name}
                            </span>
                            {p.isDefault ? <Badge variant="accent">Default</Badge> : null}
                          </span>
                          <span className="block truncate text-xs text-ink-3">{p.gameName}</span>
                        </span>
                        <span className="tnum hidden text-xs text-ink-3 sm:block">
                          {plural(p.settingCount, "setting")}
                        </span>
                        <span className="tnum text-xs whitespace-nowrap text-ink-3">
                          {timeAgo(p.updatedAt)}
                        </span>
                        <ArrowRight className="size-4 text-ink-3" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-8">
            <section aria-labelledby="favorites">
              <SectionTitle>
                <span id="favorites" className="inline-flex items-center gap-1.5">
                  <Star className="size-4 text-accent" aria-hidden /> Favorites
                </span>
              </SectionTitle>
              {data.favoriteGames.length === 0 ? (
                <p className="text-[13px] text-ink-3">Star a game from its menu to pin it here.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {data.favoriteGames.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/games/${g.slug}`}
                        className="flex items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-surface"
                      >
                        <GameCover game={g} className="[container-type:inline-size] size-9" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {g.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="quick">
              <SectionTitle>
                <span id="quick">Quick access</span>
              </SectionTitle>
              <ul className="flex flex-col gap-1 text-[13px]">
                {[
                  { href: "/search", label: "Search everything", icon: Search },
                  { href: "/export", label: "Export your library", icon: Download },
                  { href: "/import", label: "Import a file", icon: Upload },
                ].map((q) => (
                  <li key={q.href}>
                    <Link
                      href={q.href}
                      className="flex h-9 items-center gap-2.5 rounded-sm px-2 text-ink-2 hover:bg-surface hover:text-ink"
                    >
                      <q.icon className="size-4 text-ink-3" aria-hidden /> {q.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </Page>
  );
}
