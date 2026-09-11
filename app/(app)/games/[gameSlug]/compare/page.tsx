import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getGameBySlug, listPresetsForGame } from "@/lib/data/games";
import { getPresetFull, toCategoryDocs } from "@/lib/data/presets";
import { comparePresets } from "@/lib/compare/diff";
import { Page, PageHeader } from "@/components/app/page-header";
import { CompareView } from "@/components/compare/compare-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { Params, SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Compare presets" };

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Params<"gameSlug">;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { gameSlug } = await params;
  const sp = await searchParams;
  const game = await getGameBySlug(user.id, gameSlug);
  if (!game) notFound();
  const presets = (await listPresetsForGame(user.id, game.id)).filter((p) => !p.isArchived);

  const crumbs = [
    { label: "Games", href: "/games" },
    { label: game.name, href: `/games/${game.slug}` },
    { label: "Compare" },
  ];

  if (presets.length < 2) {
    return (
      <Page>
        <PageHeader crumbs={crumbs} title="Compare presets" />
        <EmptyState
          title="You need two presets to compare"
          description="Duplicate an existing preset, tweak a few values, then come back to see exactly what changed."
          action={
            <Button asChild variant="primary">
              <Link href={`/games/${game.slug}`}>Back to {game.name}</Link>
            </Button>
          }
        />
      </Page>
    );
  }

  const ids = new Set(presets.map((p) => p.id));
  const a = typeof sp.a === "string" && ids.has(sp.a) ? sp.a : presets[0]!.id;
  const bCandidate = typeof sp.b === "string" && ids.has(sp.b) ? sp.b : null;
  const b =
    bCandidate && bCandidate !== a
      ? bCandidate
      : (presets.find((p) => p.id !== a)?.id ?? presets[1]!.id);
  if (sp.a !== a || sp.b !== b) redirect(`/games/${game.slug}/compare?a=${a}&b=${b}`);

  const [presetA, presetB] = await Promise.all([
    getPresetFull(user.id, a),
    getPresetFull(user.id, b),
  ]);
  const diff = comparePresets(
    toCategoryDocs(presetA.categories),
    toCategoryDocs(presetB.categories),
  );

  return (
    <Page size="xl">
      <div style={{ "--accent": game.accentColor ?? undefined } as React.CSSProperties}>
        <PageHeader
          crumbs={crumbs}
          title="Compare presets"
          description="Settings are matched by category and name. Differences are marked with an icon and a word, not just color."
        />
        <CompareView
          gameSlug={game.slug}
          presets={presets.map((p) => ({ id: p.id, name: p.name }))}
          aId={a}
          bId={b}
          aName={presetA.name}
          bName={presetB.name}
          diff={diff}
        />
      </div>
    </Page>
  );
}
