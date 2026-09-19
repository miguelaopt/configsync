import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Crown, FileText, Laptop, Monitor, RefreshCw, UserSearch } from "lucide-react";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getGameBySlug, listPresetsForGame, touchGameOpened } from "@/lib/data/games";
import { exportGame } from "@/lib/data/export";
import { getPlan } from "@/lib/billing/plan";
import { deviceRowsForGame } from "@/lib/data/devices";
import { listGameActivity } from "@/lib/data/revisions";
import { devicesByPreset, listDeviceState, summarise } from "@/lib/data/sync";
import { DevicePresetsCard } from "@/components/games/device-presets-card";
import { GameWorkspace } from "@/components/games/game-workspace";
import { Page } from "@/components/app/page-header";
import { ComingSoonPanel, Panel } from "@/components/dashboard/panels";
import { timeAgo } from "@/lib/utils/format";
import type { Params } from "@/lib/types";
import type { CopyPayload } from "@/lib/copy/format";

export async function generateMetadata({
  params,
}: {
  params: Params<"gameSlug">;
}): Promise<Metadata> {
  const user = await requireUser();
  const game = await getGameBySlug(user.id, (await params).gameSlug);
  return { title: game?.name ?? "Game" };
}

export default async function GamePage({ params }: { params: Params<"gameSlug"> }) {
  const user = await requireUser();
  const { gameSlug } = await params;
  const game = await getGameBySlug(user.id, gameSlug);
  if (!game) notFound();

  const [presets, profile, doc, , { plan }, devices, activity] = await Promise.all([
    listPresetsForGame(user.id, game.id),
    getProfile(user.id),
    exportGame(user.id, game.id),
    touchGameOpened(user.id, game.id),
    getPlan(user.id),
    listDeviceState(user.id),
    listGameActivity(user.id, game.id, 6),
  ]);

  const deviceRows = game.catalogId
    ? await deviceRowsForGame(user.id, { id: game.id, catalogId: game.catalogId })
    : [];
  const sync = deviceRows.length ? summarise(deviceRows.map((r) => r.status.kind)) : null;

  // Categories come from the default preset — that is what the companion writes to a PC.
  const defaultDoc = doc.presets.find((p) => p.isDefault) ?? doc.presets[0] ?? null;
  const defaultPreset = presets.find((p) => p.isDefault) ?? presets[0] ?? null;
  const categories = (defaultDoc?.categories ?? []).map((c) => ({
    name: c.name,
    icon: c.icon,
    count: c.settings.length,
  }));

  const appliedBySlug = Object.fromEntries(devicesByPreset(devices, game.catalogId));
  const settingCount = presets.reduce((n, p) => n + p.settingCount, 0);

  // Whole-game copy payload: one "category" per preset+category so the output stays readable.
  const copyPayload: CopyPayload = {
    title: game.name,
    categories: doc.presets.flatMap((p) =>
      p.categories.map((c) => ({ name: `${p.name} / ${c.name}`, settings: c.settings })),
    ),
  };

  return (
    <Page size="xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3">
        <Link href="/games" className="rounded-sm hover:text-ink">
          Games
        </Link>
        <span aria-hidden className="px-2">
          ›
        </span>
        <span className="text-ink-2">{game.name}</span>
      </nav>

      <div
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_336px]"
        style={{ "--accent": game.accentColor ?? undefined } as React.CSSProperties}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <GameWorkspace
            game={game}
            presets={presets}
            categories={categories}
            categoriesPresetSlug={defaultPreset?.slug ?? null}
            settingCount={settingCount}
            sync={sync}
            appliedBySlug={appliedBySlug}
            copyPayload={copyPayload}
            copyFormat={profile?.preferences.copyFormat ?? "plain"}
          />
          {deviceRows.length && plan === "pro" ? (
            <DevicePresetsCard
              gameId={game.id}
              devices={deviceRows}
              presets={presets
                .filter((p) => !p.isArchived)
                .map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault }))}
            />
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Panel
            icon={<RefreshCw />}
            title="Sync status"
            subtitle="PCs running the companion."
            action={{ href: "/settings#companion", label: "Manage" }}
          >
            {deviceRows.length === 0 ? (
              <p className="text-[13px] text-ink-3">
                {game.catalogId
                  ? "No PC has reported in for this game yet."
                  : "Only catalog games can be applied to a PC."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {deviceRows.map((d) => (
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
                        {d.status.kind === "applied"
                          ? `Running ${d.status.presetSlug}`
                          : d.status.kind === "stale"
                            ? "Waiting to apply"
                            : d.status.kind === "failed"
                              ? "Last apply failed"
                              : d.status.kind === "waiting"
                                ? "Queued"
                                : "Never applied"}
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

          <ComingSoonPanel
            icon={<UserSearch />}
            title="Community presets"
            description="Setups other players share for this game, one click from your own library."
          />
          <ComingSoonPanel
            icon={<Crown />}
            title="Pro player setups"
            description="Verified configs from the players you watch, kept up to date."
          />

          <Panel icon={<Activity />} title="Recent activity" subtitle="Saves in this game.">
            {activity.length === 0 ? (
              <p className="text-[13px] text-ink-3">Nothing saved yet.</p>
            ) : (
              <ul className="flex flex-col">
                {activity.map((a) => (
                  <li key={a.id} className="menu-row flex items-center gap-3 py-2">
                    <Link
                      href={`/games/${game.slug}/${a.presetSlug}`}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-sm"
                    >
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised text-ink-3 [&_svg]:size-4"
                      >
                        <FileText />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">
                          {a.note ?? `Saved ${a.presetName}`}
                        </span>
                        <span className="block truncate text-xs text-ink-3">{a.presetName}</span>
                      </span>
                      <span className="shrink-0 text-xs whitespace-nowrap text-ink-3">
                        {timeAgo(a.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </Page>
  );
}
