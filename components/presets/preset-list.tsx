"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Star, Layers } from "lucide-react";
import type { listPresetsForGame } from "@/lib/data/games";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PresetDialog } from "./preset-dialog";
import { PresetActionsMenu } from "./preset-actions";
import { plural, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type PresetRow = Awaited<ReturnType<typeof listPresetsForGame>>[number];

export function PresetList({
  presets,
  gameId,
  gameSlug,
}: {
  presets: PresetRow[];
  gameId: string;
  gameSlug: string;
}) {
  const [creating, setCreating] = React.useState(false);
  const siblings = presets.filter((p) => !p.isArchived).map((p) => ({ id: p.id, name: p.name }));
  const active = presets.filter((p) => !p.isArchived);
  const archived = presets.filter((p) => p.isArchived);

  return (
    <section aria-labelledby="presets-heading">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 id="presets-heading" className="font-display text-[17px]">
          Presets
        </h2>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus /> New preset
        </Button>
      </div>

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
          <ul className="divide-y divide-hairline border-y border-hairline">
            {active.map((p) => (
              <PresetRowItem key={p.id} preset={p} gameSlug={gameSlug} siblings={siblings} />
            ))}
          </ul>
          {archived.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-[13px] text-ink-3 select-none hover:text-ink">
                {plural(archived.length, "archived preset")}
              </summary>
              <ul className="mt-2 divide-y divide-hairline border-y border-hairline opacity-70">
                {archived.map((p) => (
                  <PresetRowItem key={p.id} preset={p} gameSlug={gameSlug} siblings={siblings} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
      <PresetDialog
        open={creating}
        onOpenChange={setCreating}
        gameId={gameId}
        gameSlug={gameSlug}
        siblings={siblings}
      />
    </section>
  );
}

function PresetRowItem({
  preset,
  gameSlug,
  siblings,
}: {
  preset: PresetRow;
  gameSlug: string;
  siblings: { id: string; name: string }[];
}) {
  return (
    <li className="menu-row flex items-center gap-2 pr-1 pl-3">
      <Link
        href={`/games/${gameSlug}/${preset.slug}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 outline-offset-[-2px]"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("truncate text-[14px] font-medium text-ink")}>{preset.name}</span>
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
            <span className="mt-0.5 block truncate text-xs text-ink-2">{preset.description}</span>
          ) : null}
          <span className="tnum block truncate text-xs text-ink-3">
            {plural(preset.categoryCount, "category", "categories")},{" "}
            {plural(preset.settingCount, "setting")} · edited {timeAgo(preset.updatedAt)}
          </span>
        </span>
      </Link>
      <PresetActionsMenu preset={preset} gameSlug={gameSlug} siblings={siblings} />
    </li>
  );
}
