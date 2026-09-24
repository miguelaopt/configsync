import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ChevronRight,
  Crown,
  FileText,
  Gamepad2,
  Laptop,
  Monitor,
  RefreshCw,
  Upload,
  Users,
  UserSearch,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { listOwnedCatalogIds } from "@/lib/data/catalog";
import { publicCatalog } from "@/lib/catalog";
import { getPlan } from "@/lib/billing/plan";
import { billingEnabled } from "@/lib/env";
import { Page } from "@/components/app/page-header";
import { GameCover } from "@/components/games/game-cover";
import { NewGameButton } from "@/components/games/new-game-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiscoverPanel, Panel, SyncPill } from "@/components/dashboard/panels";
import { EmptyVault } from "@/components/dashboard/empty-vault";
import { WindowsAppCard } from "@/components/app/windows-app";
import { plural, timeAgo } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

const OVERALL_COPY = {
  synced: { label: "Everything synced", tone: "text-good" },
  pending: { label: "Changes to apply", tone: "text-accent-text" },
  failed: { label: "A PC failed to apply", tone: "text-bad" },
  never: { label: "Nothing applied yet", tone: "text-ink-3" },
} as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, catalog, owned, { plan }] = await Promise.all([
    getDashboardData(user.id),
    publicCatalog(),
    listOwnedCatalogIds(user.id),
    getPlan(user.id),
  ]);
  const firstName = user.name.split(" ")[0] || "there";
  const empty = data.totals.games === 0;
  const overall = data.overall ? OVERALL_COPY[data.overall] : null;

  return (
    <Page size="xl">
      {/* Greeting — quieter when there is nothing yet, so the empty state is the focus. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            className={
              empty
                ? "text-[26px] leading-none font-bold sm:text-[30px]"
                : "text-[34px] leading-none font-bold sm:text-[40px]"
            }
          >
            Hi <span className="text-brand">{firstName}</span>.
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
            {empty ? (
              <span>Your library is empty.</span>
            ) : (
              <>
                <span>{plural(data.totals.games, "game")}</span>
                <Dot />
                <span>{plural(data.totals.presets, "preset")}</span>
                <Dot />
                <span>{plural(data.totals.settings, "setting")}</span>
                <Dot />
                {overall ? (
                  <span className={`inline-flex items-center gap-1.5 ${overall.tone}`}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {overall.label}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    Companion offline
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        {/* With no games the only call to action belongs in the empty state. */}
        {empty ? null : (
          <div className="flex flex-wrap gap-2">
            <NewGameButton size="lg" catalog={catalog} owned={owned} />
            <Button asChild variant="secondary" size="lg">
              <Link href="/import">
                <Upload /> Import
              </Link>
            </Button>
          </div>
        )}
      </div>

      {empty ? (
        <>
          <EmptyVault catalog={catalog} owned={owned} />
          <WindowsAppCard className="mt-5 max-w-md" />
        </>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_336px]">
          {/* Main column */}
          <div className="flex min-w-0 flex-col gap-5">
            {data.recentPresets[0] ? (
              <Link
                href={`/games/${data.recentPresets[0].gameSlug}/${data.recentPresets[0].slug}`}
                className="flex w-fit items-center gap-2 rounded-sm text-[13px] text-ink-3 hover:text-ink"
              >
                <span className="text-ink-2">Continue editing</span>
                {data.recentPresets[0].gameName}
                <ChevronRight className="size-3.5" aria-hidden />
                {data.recentPresets[0].name}
              </Link>
            ) : null}
            <Panel
              icon={<Gamepad2 />}
              title="Your games"
              subtitle="Manage your games, presets and settings."
              action={{ href: "/games", label: "View all games" }}
            >
              <ul className={`grid gap-3 ${data.recentGames.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {data.recentGames.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/games/${g.slug}`}
                      className="flex items-center gap-4 rounded-xl border border-line bg-raised p-3 transition-colors hover:border-line-strong"
                    >
                      <GameCover
                        game={g}
                        ratio="wide"
                        className="[container-type:inline-size] w-28 shrink-0 rounded-lg"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">
                          {g.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
                          <span>{plural(g.presetCount, "preset")}</span>
                          <Dot />
                          <span>{plural(g.settingCount, "setting")}</span>
                          {g.platforms[0] ? (
                            <>
                              <Dot />
                              <span>{g.platforms[0]}</span>
                            </>
                          ) : null}
                          {g.sync ? <SyncPill status={g.sync} className="ml-1" /> : null}
                        </span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              icon={<FileText />}
              title="Recent presets"
              subtitle="Your latest edited presets across all games."
              action={{ href: "/search", label: "View all presets" }}
              bodyClassName="px-0 pb-0 sm:px-0 sm:pb-0"
            >
              {data.recentPresets.length === 0 ? (
                <p className="px-4 pb-4 text-[13px] text-ink-3 sm:px-5 sm:pb-5">
                  Presets you edit will show up here.
                </p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-y border-line text-left text-[11px] tracking-wide text-ink-3 uppercase">
                      <th scope="col" className="py-2.5 pl-4 font-medium sm:pl-5">
                        Preset
                      </th>
                      <th scope="col" className="hidden py-2.5 font-medium sm:table-cell">
                        Game
                      </th>
                      <th scope="col" className="hidden py-2.5 font-medium md:table-cell">
                        Last modified
                      </th>
                      <th scope="col" className="py-2.5 pr-4 font-medium sm:pr-5">
                        Sync status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPresets.map((p) => (
                      <tr key={p.id} className="menu-row border-b-0 last:border-0">
                        <td className="py-2.5 pl-4 sm:pl-5">
                          <Link
                            href={`/games/${p.gameSlug}/${p.slug}`}
                            className="flex items-center gap-2.5 rounded-sm font-medium text-ink"
                          >
                            <GameCover
                              game={{ ...p, name: p.gameName }}
                              className="[container-type:inline-size] size-7 shrink-0 rounded-md"
                            />
                            <span className="truncate">{p.name}</span>
                            {p.isDefault ? <Badge variant="accent">Default</Badge> : null}
                          </Link>
                        </td>
                        <td className="hidden truncate py-2.5 text-ink-2 sm:table-cell">
                          {p.gameName}
                        </td>
                        <td className="hidden py-2.5 whitespace-nowrap text-ink-3 md:table-cell">
                          {timeAgo(p.updatedAt)}
                        </td>
                        <td className="py-2.5 pr-4 sm:pr-5">
                          <span className="flex items-center justify-between gap-3">
                            {p.sync ? (
                              <SyncPill status={p.sync} />
                            ) : (
                              <span className="text-ink-3">—</span>
                            )}
                            <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                icon={<RefreshCw />}
                title="Sync status"
                subtitle="PCs running the companion."
                action={{ href: "/settings#companion", label: "Manage" }}
              >
                {data.devices.length === 0 ? (
                  <p className="text-[13px] text-ink-3">
                    No PC has reported in yet. Install the companion from{" "}
                    <Link href="/settings#companion" className="text-accent-text hover:text-ink">
                      Settings
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.devices.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2.5"
                      >
                        <span
                          aria-hidden
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-3 [&_svg]:size-[18px]"
                        >
                          {/laptop|mac|book/i.test(d.name) ? <Laptop /> : <Monitor />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {d.name}
                          </span>
                          <span className="block truncate text-xs text-ink-3">
                            {d.platform ?? "Unknown"} · {plural(d.games, "game")} applied
                          </span>
                        </span>
                        <span className="shrink-0 text-xs whitespace-nowrap text-ink-3">
                          {timeAgo(d.lastSeenAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel icon={<Activity />} title="Recent activity" subtitle="What changed, and when.">
                {data.activity.length === 0 ? (
                  <p className="text-[13px] text-ink-3">Nothing has happened yet.</p>
                ) : (
                  <ul className="flex flex-col">
                    {data.activity.map((a, i) => {
                      const row = (
                        <>
                          <span
                            aria-hidden
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised text-ink-3 [&_svg]:size-4"
                          >
                            {a.kind === "device" ? <RefreshCw /> : <FileText />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-ink">{a.text}</span>
                            <span className="block truncate text-xs text-ink-3">{a.detail}</span>
                          </span>
                          <span className="shrink-0 text-xs whitespace-nowrap text-ink-3">
                            {timeAgo(a.at)}
                          </span>
                        </>
                      );
                      return (
                        <li
                          key={`${a.text}-${i}`}
                          className="menu-row flex items-center gap-3 py-2"
                        >
                          {a.href ? (
                            <Link
                              href={a.href}
                              className="flex min-w-0 flex-1 items-center gap-3 rounded-sm"
                            >
                              {row}
                            </Link>
                          ) : (
                            row
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          {/* Rail */}
          <aside className="flex min-w-0 flex-col gap-5">
            <WindowsAppCard />
            <DiscoverPanel
              items={[
                {
                  icon: <Users />,
                  title: "Friends",
                  description: "See what your friends are playing.",
                },
                {
                  icon: <UserSearch />,
                  title: "Public profiles",
                  description: "Discover and save community setups.",
                },
                {
                  icon: <Crown />,
                  title: "Pro players",
                  description: "Verified setups from competitive players.",
                },
              ]}
            />
            {billingEnabled && plan !== "pro" ? (
              <section className="panel flex flex-col gap-3 p-5">
                <h2 className="text-[15px] font-semibold text-ink">Go further with Pro</h2>
                <p className="text-[13px] text-ink-2">
                  Unlimited games and history, auto-switch on every PC, per-PC presets and the AI
                  screenshot importer.
                </p>
                <Button asChild variant="primary" size="lg" className="mt-1 w-full">
                  <Link href="/pricing">Upgrade to Pro</Link>
                </Button>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </Page>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-ink-3">
      ·
    </span>
  );
}
