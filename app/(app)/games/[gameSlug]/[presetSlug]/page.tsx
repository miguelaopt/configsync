import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getGameBySlug, listPresetsForGame } from "@/lib/data/games";
import { getPresetBySlug, getPresetFull, toCategoryDocs } from "@/lib/data/presets";
import { listRevisions } from "@/lib/data/revisions";
import { getPlan } from "@/lib/billing/plan";
import { screenshotAssistantEnabled } from "@/lib/env";
import { publicCatalog } from "@/lib/catalog";
import { Page, PageHeader } from "@/components/app/page-header";
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

  return (
    <Page size="xl">
      <div style={{ "--accent": game.accentColor ?? undefined } as React.CSSProperties}>
        <PageHeader
          crumbs={[
            { label: "Games", href: "/games" },
            { label: game.name, href: `/games/${game.slug}` },
            { label: preset.name },
          ]}
          title=""
          className="mb-0 [&_h1]:hidden"
        />
        <PresetHeader
          game={game}
          preset={presetOnly}
          siblings={siblings.filter((p) => !p.isArchived).map((p) => ({ id: p.id, name: p.name }))}
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
    </Page>
  );
}
