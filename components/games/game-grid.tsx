"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import type { GameListItem } from "@/lib/data/games";
import {
  deleteGameAction,
  setGameArchivedAction,
  setGameFavoriteAction,
} from "@/lib/actions/games";
import { GameCover } from "./game-cover";
import { GameDialog } from "./game-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function GameGrid({ games }: { games: GameListItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {games.map((game) => (
        <GameTile key={game.id} game={game} />
      ))}
    </ul>
  );
}

export function GameTile({ game }: { game: GameListItem }) {
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
    <li className="group relative">
      <Link
        href={`/games/${game.slug}`}
        className="block rounded-md outline-offset-4"
        aria-label={`Open ${game.name}`}
      >
        <GameCover game={game} className="[container-type:inline-size] w-full" />
        <div className="mt-2 flex items-start justify-between gap-2 pr-8">
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-medium text-ink">{game.name}</h3>
            <p className="truncate text-xs text-ink-3">
              {plural(game.presetCount, "preset")}
              {game.platforms.length ? ` · ${game.platforms.join(", ")}` : ""}
            </p>
          </div>
          {game.isFavorite ? (
            <Star
              className="mt-0.5 size-3.5 shrink-0 fill-accent text-accent"
              aria-label="Favorite"
            />
          ) : null}
        </div>
      </Link>
      <div className="absolute right-0 bottom-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${game.name}`}
              className={cn("text-ink-3")}
            >
              <MoreHorizontal />
            </Button>
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
