"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Clock,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import type { GameListItem } from "@/lib/data/games";
import type { SyncLabel } from "@/lib/data/sync";
import {
  deleteGameAction,
  setGameArchivedAction,
  setGameFavoriteAction,
} from "@/lib/actions/games";
import { GameCover } from "./game-cover";
import { GameDialog } from "./game-dialog";
import { SyncPill } from "@/components/dashboard/panels";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { plural, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** A library card: cover, what is in the game, how it stands on your PCs, and a way in. */
export function GameCard({ game, sync }: { game: GameListItem; sync?: SyncLabel }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    const r = await p;
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(msg);
    router.refresh();
  };

  return (
    <li className="panel group relative flex flex-col overflow-hidden">
      <Link
        href={`/games/${game.slug}`}
        className="block outline-offset-[-2px]"
        aria-label={`Open ${game.name}`}
      >
        <GameCover
          game={game}
          ratio="wide"
          className="[container-type:inline-size] w-full rounded-none"
        />
      </Link>

      <div className="absolute top-2.5 right-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${game.name}`}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-[rgb(15_16_25/0.7)] text-ink backdrop-blur-sm transition-colors hover:bg-[rgb(15_16_25/0.9)]"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Edit game
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                run(
                  setGameFavoriteAction(game.id, !game.isFavorite),
                  game.isFavorite ? "Removed from favorites" : "Added to favorites",
                )
              }
            >
              <Star className={cn(game.isFavorite && "fill-current")} />{" "}
              {game.isFavorite ? "Unfavorite" : "Favorite"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                run(
                  setGameArchivedAction(game.id, !game.isArchived),
                  game.isArchived ? "Game restored" : "Game archived",
                )
              }
            >
              {game.isArchived ? <ArchiveRestore /> : <Archive />}{" "}
              {game.isArchived ? "Restore" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="flex items-center gap-2 text-[19px] leading-tight font-semibold text-ink">
          <Link href={`/games/${game.slug}`} className="min-w-0 truncate rounded-sm">
            {game.name}
          </Link>
          {game.isFavorite ? (
            <Star className="size-4 shrink-0 fill-accent text-accent" aria-label="Favorite" />
          ) : null}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {game.platforms.slice(0, 2).map((p) => (
            <Badge key={p} variant="outline">
              {p}
            </Badge>
          ))}
          {sync ? <SyncPill status={sync} /> : null}
        </div>

        <p className="text-[13px] text-ink-3">
          {plural(game.presetCount, "preset")} · {plural(game.settingCount, "setting")}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
            <Clock className="size-3.5" aria-hidden />
            Updated {timeAgo(game.updatedAt)}
          </span>
          <Link
            href={`/games/${game.slug}`}
            className="flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-accent-text hover:text-ink"
          >
            Open game
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      <GameDialog open={editing} onOpenChange={setEditing} game={game} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${game.name}?`}
        description={`This permanently deletes the game and its ${plural(game.presetCount, "preset")}. Export it first if you might want it back.`}
        confirmLabel="Delete game"
        onConfirm={() => run(deleteGameAction(game.id), "Game deleted")}
      />
    </li>
  );
}

/** The dashed slot at the end of the grid. */
export function AddGameCard({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-line-strong p-6 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-2xl leading-none text-accent-text"
      >
        +
      </span>
      <span className="text-[17px] font-semibold text-ink">Add another game</span>
      <span className="max-w-52 text-[13px] text-ink-3">
        Import a config or create a preset manually.
      </span>
      <span className="mt-1">{children}</span>
    </li>
  );
}
