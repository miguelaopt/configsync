"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Download,
  FileText,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Star,
  Table,
  Trash2,
  X,
} from "lucide-react";
import type { Game } from "@/lib/db/schema";
import {
  deleteGameAction,
  removeGameCoverAction,
  setGameArchivedAction,
  setGameFavoriteAction,
} from "@/lib/actions/games";
import { GameDialog } from "./game-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

function useRun() {
  const router = useRouter();
  return async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    const r = await p;
    if (!r.ok) return toast.error(r.error);
    toast.success(msg);
    router.refresh();
  };
}

/** Upload / replace / remove the cover art. Sits under the cover in the game hero. */
export function GameCoverControls({ game }: { game: Game }) {
  const router = useRouter();
  const run = useRun();
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const hasCover = Boolean(game.coverAttachmentId || game.coverUrl);

  const upload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) return toast.error("Images must be 2 MB or smaller.");
    setUploading(true);
    try {
      const res = await fetch(`/api/games/${game.id}/cover`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return toast.error(body?.error ?? "Couldn't upload that image.");
      toast.success("Cover updated");
      router.refresh();
    } catch {
      toast.error("Couldn't upload that image. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-2 flex gap-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        aria-label="Upload cover image"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <Tooltip content={hasCover ? "Replace cover" : "Upload cover"}>
        <Button
          variant="ghost"
          size="icon-sm"
          loading={uploading}
          onClick={() => fileRef.current?.click()}
          aria-label={hasCover ? "Replace cover image" : "Upload cover image"}
        >
          <ImagePlus />
        </Button>
      </Tooltip>
      {hasCover ? (
        <Tooltip content="Remove cover">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => run(removeGameCoverAction(game.id), "Cover removed")}
            aria-label="Remove cover image"
          >
            <X />
          </Button>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Edit, favourite, export, archive and delete for one game. */
export function GameMenu({ game }: { game: Game }) {
  const router = useRouter();
  const run = useRun();
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const exportHref = (format: "json" | "md" | "csv") =>
    `/api/export?scope=game&id=${game.id}&format=${format}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Game actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
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
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download /> Export game
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem asChild>
                <a href={exportHref("json")}>
                  <FileText /> JSON
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportHref("md")}>
                  <FileText /> Markdown
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportHref("csv")}>
                  <Table /> CSV
                </a>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
            <Trash2 /> Delete game…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <GameDialog open={editing} onOpenChange={setEditing} game={game} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${game.name}?`}
        description="This permanently deletes the game and every preset in it. Export it first if you might want it back."
        confirmLabel="Delete game"
        onConfirm={async () => {
          const r = await deleteGameAction(game.id);
          if (!r.ok) return toast.error(r.error);
          toast.success("Game deleted");
          router.push("/games");
        }}
      />
    </>
  );
}
