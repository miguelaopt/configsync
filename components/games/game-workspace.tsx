"use client";
import * as React from "react";
import Link from "next/link";
import { GitCompare, Play, Plus, Star, Upload } from "lucide-react";
import type { Game } from "@/lib/db/schema";
import type { listPresetsForGame } from "@/lib/data/games";
import type { SyncLabel } from "@/lib/data/sync";
import { getCatalogGame } from "@/lib/catalog";
import { CATEGORY_ICONS } from "@/lib/settings/icons";
import { GameCover } from "./game-cover";
import { GameCoverControls, GameMenu } from "./game-header";
import { PresetDialog } from "@/components/presets/preset-dialog";
import { PresetActionsMenu } from "@/components/presets/preset-actions";
import { Panel, SyncPill } from "@/components/dashboard/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyMenu } from "@/components/app/copy-menu";
import type { CopyFormat, CopyPayload } from "@/lib/copy/format";
import { plural, timeAgo } from "@/lib/utils/format";
import { Layers } from "lucide-react";

type PresetRow = Awaited<ReturnType<typeof listPresetsForGame>>[number];
type CategoryTile = { name: string; icon?: string | null; count: number };

type Props = {
  game: Game;
  presets: PresetRow[];
  categories: CategoryTile[];
  /** Slug of the preset the categories belong to, for the "view all" link. */
  categoriesPresetSlug: string | null;
  settingCount: number;
  sync: SyncLabel | null;
  /** How many PCs currently have each preset applied, by preset slug. */
  appliedBySlug: Record<string, number>;
  copyPayload: CopyPayload;
  copyFormat: CopyFormat;
};

/**
 * The game page's main column. It is one client component because the hero's "New preset"
 * button and the presets panel share the same dialog.
 */
export function GameWorkspace({
  game,
  presets,
  categories,
  categoriesPresetSlug,
  settingCount,
  sync,
  appliedBySlug,
  copyPayload,
  copyFormat,
}: Props) {
  const [creating, setCreating] = React.useState(false);
  const active = presets.filter((p) => !p.isArchived);
  const archived = presets.filter((p) => p.isArchived);
  const siblings = active.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Hero */}
      <section className="panel relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25">
          <GameCover
            game={game}
            ratio="wide"
            className="[container-type:inline-size] h-full w-full rounded-none blur-2xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--surface)_35%,transparent)]" />
        </div>

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:gap-6 sm:p-6">
          <div className="w-28 shrink-0 sm:w-40">
            <GameCover game={game} className="[container-type:inline-size] w-full rounded-xl" />
            <GameCoverControls game={game} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <h1 className="flex items-center gap-2 text-[30px] leading-tight font-bold tracking-[-0.024em] sm:text-[38px]">
              <span className="truncate">{game.name}</span>
              {game.isFavorite ? (
                <Star className="size-5 shrink-0 fill-accent text-accent" aria-label="Favorite" />
              ) : null}
            </h1>

            <div className="flex flex-wrap items-center gap-1.5">
              {game.platforms.map((p) => (
                <Badge key={p} variant="neutral">
                  {p}
                </Badge>
              ))}
              {game.tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
              {game.catalogId ? (
                <Badge>Catalog · {getCatalogGame(game.catalogId)?.name ?? game.catalogId}</Badge>
              ) : null}
              {game.isArchived ? <Badge variant="bad">Archived</Badge> : null}
            </div>

            <p className="text-[13px] text-ink-3">
              {plural(active.length, "preset")} · {plural(settingCount, "setting")} · last updated{" "}
              {timeAgo(game.updatedAt)}
            </p>

            {sync ? <SyncPill status={sync} className="w-fit" /> : null}

            {game.notes ? (
              <p className="max-w-prose text-[13px] whitespace-pre-line text-ink-2">{game.notes}</p>
            ) : null}

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
                <Plus /> New preset
              </Button>
              {active.length >= 2 ? (
                <Button asChild variant="secondary" size="lg">
                  <Link href={`/games/${game.slug}/compare`}>
                    <GitCompare /> Compare presets
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary" size="lg">
                <Link href="/import">
                  <Upload /> Import config
                </Link>
              </Button>
              {presets.length > 0 ? (
                <CopyMenu
                  getPayload={() => copyPayload}
                  defaultFormat={copyFormat}
                  what="the whole game"
                  label="Copy all"
                />
              ) : null}
              <GameMenu game={game} />
            </div>
          </div>
        </div>
      </section>

      {/* Presets */}
      <Panel
        title="Presets"
        subtitle={`Manage your configuration presets for ${game.name}.`}
        action={
          active.length >= 2 ? { href: `/games/${game.slug}/compare`, label: "Compare" } : undefined
        }
      >
        {presets.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="No presets yet"
            description="A preset is one complete set of settings. Start with “Main Setup” and add more as you experiment."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus /> Create the first preset
              </Button>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {active.map((p) => (
                <PresetCard
                  key={p.id}
                  preset={p}
                  gameSlug={game.slug}
                  siblings={siblings}
                  appliedOn={appliedBySlug[p.slug] ?? 0}
                />
              ))}
            </ul>
            {archived.length > 0 ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] text-ink-3 select-none hover:text-ink">
                  {plural(archived.length, "archived preset")}
                </summary>
                <ul className="mt-3 flex flex-col gap-3 opacity-70">
                  {archived.map((p) => (
                    <PresetCard
                      key={p.id}
                      preset={p}
                      gameSlug={game.slug}
                      siblings={siblings}
                      appliedOn={0}
                    />
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </Panel>

      {/* Categories of the default preset */}
      {categories.length > 0 && categoriesPresetSlug ? (
        <Panel
          title="Settings categories"
          subtitle="The categories in this game's default preset."
          action={{
            href: `/games/${game.slug}/${categoriesPresetSlug}`,
            label: "View all settings",
          }}
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {categories.map((c) => {
              const Icon = (c.icon && CATEGORY_ICONS[c.icon]) || CATEGORY_ICONS.gamepad;
              return (
                <li key={c.name}>
                  <Link
                    href={`/games/${game.slug}/${categoriesPresetSlug}`}
                    className="flex h-full flex-col items-center gap-2 rounded-xl border border-line bg-raised px-3 py-4 text-center transition-colors hover:border-line-strong"
                  >
                    {Icon ? <Icon className="size-6 text-accent-text" aria-hidden /> : null}
                    <span className="text-[13px] leading-tight font-medium text-ink">{c.name}</span>
                    <span className="text-xs text-ink-3">{plural(c.count, "setting")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <PresetDialog
        open={creating}
        onOpenChange={setCreating}
        gameId={game.id}
        gameSlug={game.slug}
        siblings={siblings}
      />
    </div>
  );
}

function PresetCard({
  preset,
  gameSlug,
  siblings,
  appliedOn,
}: {
  preset: PresetRow;
  gameSlug: string;
  siblings: { id: string; name: string }[];
  appliedOn: number;
}) {
  const href = `/games/${gameSlug}/${preset.slug}`;
  return (
    <li
      className={`flex flex-wrap items-center gap-4 rounded-xl border bg-raised p-4 transition-colors ${
        preset.isDefault ? "border-accent/45" : "border-line hover:border-line-strong"
      }`}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text"
      >
        <Layers className="size-5" />
      </span>

      <Link href={href} className="min-w-0 flex-1 rounded-sm outline-offset-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[16px] font-semibold text-ink">{preset.name}</span>
          {preset.isDefault ? <Badge variant="accent">Default</Badge> : null}
          {preset.isFavorite ? (
            <Star className="size-3.5 fill-accent text-accent" aria-label="Favorite" />
          ) : null}
          {preset.tags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </span>
        {preset.description ? (
          <span className="mt-0.5 block truncate text-[13px] text-ink-2">{preset.description}</span>
        ) : null}
        <span className="mt-0.5 block text-[13px] text-ink-3">
          {plural(preset.categoryCount, "category", "categories")} ·{" "}
          {plural(preset.settingCount, "setting")}
        </span>
      </Link>

      <span className="hidden text-[13px] text-ink-3 md:block">
        Edited {timeAgo(preset.updatedAt)}
      </span>

      <span className="text-[13px] whitespace-nowrap text-ink-3">
        {appliedOn > 0 ? (
          <span className="inline-flex items-center gap-2 text-good">
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            On {plural(appliedOn, "PC")}
          </span>
        ) : (
          "Not applied"
        )}
      </span>

      <span className="ml-auto flex items-center gap-2">
        <Button asChild variant="primary" size="sm">
          <Link href={href}>
            <Play /> Open
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
          <Link href={`/games/${gameSlug}/compare?a=${preset.slug}`}>
            <GitCompare /> Compare
          </Link>
        </Button>
        <PresetActionsMenu preset={preset} gameSlug={gameSlug} siblings={siblings} />
      </span>
    </li>
  );
}
