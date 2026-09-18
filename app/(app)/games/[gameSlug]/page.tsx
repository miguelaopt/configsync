import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getGameBySlug, listPresetsForGame, touchGameOpened } from "@/lib/data/games";
import { exportGame } from "@/lib/data/export";
import { getPlan } from "@/lib/billing/plan";
import { deviceRowsForGame } from "@/lib/data/devices";
import { DevicePresetsCard } from "@/components/games/device-presets-card";
import { Page, PageHeader } from "@/components/app/page-header";
import { GameHeader } from "@/components/games/game-header";
import { PresetList } from "@/components/presets/preset-list";
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
  const [presets, profile, doc, , { plan }] = await Promise.all([
    listPresetsForGame(user.id, game.id),
    getProfile(user.id),
    exportGame(user.id, game.id),
    touchGameOpened(user.id, game.id),
    getPlan(user.id),
  ]);
  const deviceRows =
    game.catalogId && plan === "pro"
      ? await deviceRowsForGame(user.id, { id: game.id, catalogId: game.catalogId })
      : [];

  // Whole-game copy payload: one "category" per preset+category so the output stays readable.
  const copyPayload: CopyPayload = {
    title: game.name,
    categories: doc.presets.flatMap((p) =>
      p.categories.map((c) => ({ name: `${p.name} / ${c.name}`, settings: c.settings })),
    ),
  };

  return (
    <Page size="lg">
      <div style={{ "--accent": game.accentColor ?? undefined } as React.CSSProperties}>
        <PageHeader
          crumbs={[{ label: "Games", href: "/games" }, { label: game.name }]}
          title=""
          className="mb-0 [&_h1]:hidden"
        />
        <GameHeader
          game={game}
          presetCount={presets.length}
          copyPayload={copyPayload}
          copyFormat={profile?.preferences.copyFormat ?? "plain"}
        />
        <PresetList presets={presets} gameId={game.id} gameSlug={game.slug} />
        {deviceRows.length ? (
          <DevicePresetsCard
            gameId={game.id}
            devices={deviceRows}
            presets={presets
              .filter((p) => !p.isArchived)
              .map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault }))}
          />
        ) : null}
      </div>
    </Page>
  );
}
