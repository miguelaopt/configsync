import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getGameBySlug, listPresetsForGame } from "@/lib/data/games";
import { getPresetBySlug, getPresetFull, toCategoryDocs } from "@/lib/data/presets";
import { listRevisions } from "@/lib/data/revisions";
import { getPlan } from "@/lib/billing/plan";
import { screenshotAssistantEnabled } from "@/lib/env";
import { publicCatalog } from "@/lib/catalog";
import Link from "next/link";
import { deviceRowsForGame } from "@/lib/data/devices";
import { summarise } from "@/lib/data/sync";
import { Page } from "@/components/app/page-header";
import { GameBand } from "@/components/presets/game-band";
import { PresetRail } from "@/components/presets/preset-rail";
import { PresetHeader } from "@/components/presets/preset-header";
import { PresetEditor } from "@/components/settings/preset-editor";
import type { Params } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Params<"gameSlug" | "presetSlug">;
}): Promise<Metadata> {
  const user = await requireUser();
  const { gameSlug, presetSlug } = await params;
  const game = await getGameBySlug(user.id, gameSlug);
  const preset = game ? await getPresetBySlug(user.id, game.id, presetSlug) : null;
  return { title: preset && game ? `${preset.name} · ${game.name}` : "Preset" };
}

export default async function PresetPage({
  params,
}: {
  params: Params<"gameSlug" | "presetSlug">;
}) {
  const user = await requireUser();
  const { gameSlug, presetSlug } = await params;
  const game = await getGameBySlug(user.id, gameSlug);
  if (!game) notFound();
  const presetRow = await getPresetBySlug(user.id, game.id, presetSlug);
  if (!presetRow) notFound();
  const [preset, siblings, profile, revisions, { plan }] = await Promise.all([
    getPresetFull(user.id, presetRow.id),
    listPresetsForGame(user.id, game.id),
    getProfile(user.id),
    listRevisions(user.id, presetRow.id),
    getPlan(user.id),
  ]);
  const { categories, ...presetOnly } = preset;
  const settingCount = categories.reduce((n, c) => n + c.settings.length, 0);
  const copyFormat = profile?.preferences.copyFormat ?? "plain";
  const catalogEntry = game.catalogId
    ? (publicCatalog().find((c) => c.id === game.catalogId) ?? null)
    : null;
  const deviceRows = game.catalogId
    ? await deviceRowsForGame(user.id, { id: game.id, catalogId: game.catalogId })
    : [];
  const sync = deviceRows.length ? summarise(deviceRows.map((r) => r.status.kind)) : null;
  const activeSiblings = siblings.filter((p) => !p.isArchived);

  return (
    <Page size="xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3">
        <Link href="/games" className="rounded-sm hover:text-ink">
          Games
        </Link>
        <span aria-hidden className="px-2">
          ›
        </span>
        <Link href={`/games/${game.slug}`} className="rounded-sm hover:text-ink">
          {game.name}
        </Link>
        <span aria-hidden className="px-2">
          ›
        </span>
        <span className="text-ink-2">{preset.name}</span>
      </nav>

      <div
        className="flex flex-col gap-5"
        style={{ "--accent": game.accentColor ?? undefined } as React.CSSProperties}
      >
        <GameBand
          game={game}
          stats={{
            presets: activeSiblings.length,
            settings: settingCount,
            categories: categories.length,
          }}
          sync={sync}
        />

        <div className="grid items-start gap-5 xl:grid-cols-[288px_minmax(0,1fr)]">
          <PresetRail presets={siblings} gameSlug={game.slug} currentSlug={preset.slug} />

          <div className="panel min-w-0 p-4 sm:p-5">
            <PresetHeader
              game={game}
              preset={presetOnly}
              siblings={activeSiblings.map((p) => ({ id: p.id, name: p.name }))}
              copyPayload={{
                title: `${game.name} — ${preset.name}`,
                categories: toCategoryDocs(categories),
              }}
              copyFormat={copyFormat}
              settingCount={settingCount}
              revisions={revisions}
              catalogEntry={catalogEntry}
              publicUrl={
                profile?.isPublic ? `/p/${profile.username}/${game.slug}/${preset.slug}` : null
              }
              ai={{
                enabled: screenshotAssistantEnabled,
                pro: plan === "pro",
                categories: categories.map((c) => ({ id: c.id, name: c.name })),
              }}
            />
            <PresetEditor
              game={game}
              preset={presetOnly}
              categories={categories}
              preferences={profile?.preferences ?? {}}
            />
          </div>
        </div>
      </div>
    </Page>
  );
}
