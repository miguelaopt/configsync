import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gamepad2, UserSearch } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listGames } from "@/lib/data/games";
import { listRecentPresets } from "@/lib/data/presets";
import { listOwnedCatalogIds } from "@/lib/data/catalog";
import { listDeviceState, syncLabelsForGames } from "@/lib/data/sync";
import { publicCatalog } from "@/lib/catalog";
import { Page } from "@/components/app/page-header";
import { AddGameCard, GameCard } from "@/components/games/game-card";
import { GameCover } from "@/components/games/game-cover";
import { EmptyState } from "@/components/ui/empty-state";
import { LibraryToolbar } from "@/components/games/library-toolbar";
import { NewGameButton } from "@/components/games/new-game-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComingSoonPanel, Panel, SyncPill } from "@/components/dashboard/panels";
import { plural, timeAgo } from "@/lib/utils/format";
import type { GameSort, SearchParams } from "@/lib/types";
import { Upload } from "lucide-react";

export const metadata: Metadata = { title: "Games" };

const SORTS: GameSort[] = ["updated", "name", "presets"];

export default async function GamesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const archived = params.view === "archived";
  const openNew = params.new === "1";
  const sort = SORTS.includes(params.sort as GameSort) ? (params.sort as GameSort) : "updated";

  const [games, catalog, owned, devices, recent] = await Promise.all([
    listGames(user.id, { archived, query: q, sort }),
    publicCatalog(),
    listOwnedCatalogIds(user.id),
    listDeviceState(user.id),
    listRecentPresets(user.id, 5),
  ]);
  const sync = await syncLabelsForGames(user.id, games, devices.length > 0);
  const totals = games.reduce(
    (a, g) => ({
      presets: a.presets + g.presetCount,
      settings: a.settings + g.settingCount,
    }),
    { presets: 0, settings: 0 },
  );

  return (
    <Page size="xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-brand w-fit text-[34px] leading-none font-bold sm:text-[40px]">
            {archived ? "Archived games" : "Games"}
          </h1>
          <p className="mt-2.5 text-[15px] text-ink-2">
            {archived
              ? "Archived games stay searchable and exportable."
              : "Manage your library of games and presets."}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-3">
            {games.length} {archived ? "archived" : "active"}{" "}
            {games.length === 1 ? "game" : "games"} · {plural(totals.presets, "preset")} ·{" "}
            {plural(totals.settings, "setting")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewGameButton autoOpen={openNew} size="lg" catalog={catalog} owned={owned} />
          <Button asChild variant="secondary" size="lg">
            <Link href="/import">
              <Upload /> Import config
            </Link>
          </Button>
        </div>
      </div>

      <LibraryToolbar query={q} archived={archived} sort={sort} />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="flex min-w-0 flex-col gap-5">
          {games.length === 0 ? (
            q ? (
              <EmptyState
                icon={<Gamepad2 />}
                title={`No games match “${q}”`}
                description="Try a different name, platform or tag."
                action={
                  <Button asChild variant="secondary">
                    <Link href={archived ? "/games?view=archived" : "/games"}>Clear search</Link>
                  </Button>
                }
              />
            ) : archived ? (
              <EmptyState
                icon={<Gamepad2 />}
                title="Nothing archived"
                description="Archive a game from its menu to tuck it away without deleting anything."
              />
            ) : (
              <EmptyState
                icon={<Gamepad2 />}
                title="Add your first game"
                description="Any game works — you name it, add presets, and build categories that mirror the game's own menu."
                action={
                  <>
                    <NewGameButton variant="primary" catalog={catalog} owned={owned} />
                    <Button asChild variant="secondary">
                      <Link href="/import">Import a file</Link>
                    </Button>
                  </>
                }
              />
            )
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {games.map((g) => (
                <GameCard key={g.id} game={g} sync={sync.get(g.id)} />
              ))}
              {!archived ? (
                <AddGameCard>
                  <NewGameButton variant="primary" catalog={catalog} owned={owned} />
                </AddGameCard>
              ) : null}
            </ul>
          )}

          {recent.length > 0 ? (
            <Panel
              title="Recently updated"
              subtitle="Latest changes to your games and presets."
              action={{ href: "/search", label: "View all" }}
              bodyClassName="px-0 pb-0 sm:px-0 sm:pb-0"
            >
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-y border-line text-left text-[11px] tracking-wide text-ink-3 uppercase">
                    <th scope="col" className="py-2.5 pl-4 font-medium sm:pl-5">
                      Game
                    </th>
                    <th scope="col" className="py-2.5 font-medium">
                      Preset
                    </th>
                    <th scope="col" className="hidden py-2.5 font-medium md:table-cell">
                      Last modified
                    </th>
                    <th scope="col" className="py-2.5 pr-4 font-medium sm:pr-5">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.id} className="menu-row border-b-0 last:border-0">
                      <td className="py-2.5 pl-4 sm:pl-5">
                        <Link
                          href={`/games/${p.gameSlug}`}
                          className="flex items-center gap-2.5 rounded-sm text-ink"
                        >
                          <GameCover
                            game={{ ...p, name: p.gameName }}
                            className="[container-type:inline-size] size-7 shrink-0 rounded-md"
                          />
                          <span className="truncate">{p.gameName}</span>
                        </Link>
                      </td>
                      <td className="py-2.5">
                        <Link
                          href={`/games/${p.gameSlug}/${p.slug}`}
                          className="flex items-center gap-2 rounded-sm font-medium text-ink"
                        >
                          <span className="truncate">{p.name}</span>
                          {p.isDefault ? <Badge variant="accent">Default</Badge> : null}
                        </Link>
                      </td>
                      <td className="hidden py-2.5 whitespace-nowrap text-ink-3 md:table-cell">
                        {timeAgo(p.updatedAt)}
                      </td>
                      <td className="py-2.5 pr-4 sm:pr-5">
                        {sync.get(p.gameId) ? (
                          <SyncPill status={sync.get(p.gameId)!} />
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <ComingSoonPanel
            icon={<UserSearch />}
            title="Community presets"
            description="Popular setups from other players, ready to copy into your own library."
          />
          <Panel
            title="Everything exports"
            subtitle="Your library is yours to take."
            bodyClassName="pt-0"
          >
            <p className="text-[13px] text-ink-2">
              Download every game, preset, setting and snapshot as one JSON file, or a single preset
              as text, Markdown or CSV.
            </p>
            <Link
              href="/export"
              className="mt-3 flex w-fit items-center gap-1.5 rounded-sm text-[13px] font-medium text-accent-text hover:text-ink"
            >
              Open export
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Panel>
        </aside>
      </div>
    </Page>
  );
}
