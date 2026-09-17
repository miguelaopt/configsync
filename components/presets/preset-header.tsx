"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitCompare, Star } from "lucide-react";
import type { Game, Preset } from "@/lib/db/schema";
import type { PublicCatalogEntry } from "@/lib/catalog";
import type { CopyPayload, CopyFormat } from "@/lib/copy/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyMenu } from "@/components/app/copy-menu";
import { PresetActionsMenu } from "./preset-actions";
import { HistoryDialog, type RevisionSummary } from "./history-dialog";
import { timeAgo } from "@/lib/utils/format";

type Props = {
  game: Game;
  preset: Preset;
  siblings: { id: string; name: string }[];
  copyPayload: CopyPayload;
  copyFormat: CopyFormat;
  settingCount: number;
  revisions: RevisionSummary[];
  catalogEntry?: PublicCatalogEntry | null;
};

export function PresetHeader({
  game,
  preset,
  siblings,
  copyPayload,
  copyFormat,
  settingCount,
  revisions,
  catalogEntry,
}: Props) {
  const router = useRouter();
  const [history, setHistory] = React.useState(false);
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-[26px] leading-tight sm:text-[30px]">
            <span className="truncate">{preset.name}</span>
            {preset.isFavorite ? (
              <Star className="size-5 shrink-0 fill-accent text-accent" aria-label="Favorite" />
            ) : null}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
            {preset.isDefault ? <Badge variant="accent">Default</Badge> : null}
            {preset.isArchived ? <Badge variant="bad">Archived</Badge> : null}
            {preset.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
            <span className="text-ink-3">edited {timeAgo(preset.updatedAt)}</span>
            {revisions.length > 0 ? (
              <button
                type="button"
                onClick={() => setHistory(true)}
                className="cursor-pointer text-ink-3 underline-offset-4 hover:text-ink hover:underline"
              >
                {revisions.length} {revisions.length === 1 ? "revision" : "revisions"}
              </button>
            ) : null}
          </div>
          {preset.description ? (
            <p className="mt-2 max-w-prose text-[13px] text-ink-2">{preset.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {settingCount > 0 ? (
            <CopyMenu
              getPayload={() => copyPayload}
              defaultFormat={copyFormat}
              what={`${settingCount} settings`}
              label="Copy preset"
              variant="primary"
            />
          ) : null}
          {siblings.length > 1 ? (
            <Button asChild variant="secondary">
              <Link href={`/games/${game.slug}/compare?a=${preset.id}`}>
                <GitCompare /> Compare
              </Link>
            </Button>
          ) : null}
          <PresetActionsMenu
            preset={preset}
            gameSlug={game.slug}
            siblings={siblings}
            catalogEntry={catalogEntry}
            onShowHistory={() => setHistory(true)}
            onDeleted={() => router.push(`/games/${game.slug}`)}
            className="border border-line bg-raised"
          />
        </div>
      </div>
      {preset.notes ? (
        <div className="mt-4 rounded-sm border-l-2 border-accent bg-surface px-3 py-2 text-[13px] whitespace-pre-line text-ink-2">
          {preset.notes}
        </div>
      ) : null}
      <HistoryDialog
        open={history}
        onOpenChange={setHistory}
        presetId={preset.id}
        revisions={revisions}
      />
    </header>
  );
}
