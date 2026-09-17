"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Download,
  FileText,
  GitCompare,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Star,
  Table,
  Trash2,
  X,
} from "lucide-react";
import type { Game } from "@/lib/db/schema";
import { getCatalogGame } from "@/lib/catalog";
import {
  deleteGameAction,
  removeGameCoverAction,
  setGameArchivedAction,
  setGameFavoriteAction,
} from "@/lib/actions/games";
import { GameCover } from "./game-cover";
import { GameDialog } from "./game-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CopyMenu } from "@/components/app/copy-menu";
import type { CopyPayload } from "@/lib/copy/format";
import type { CopyFormat } from "@/lib/copy/format";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Props = {
  game: Game;
  presetCount: number;
  /** Lazily-built copy payload of the entire game (all presets). */
  copyPayload: CopyPayload;
  copyFormat: CopyFormat;
};

export function GameHeader({ game, presetCount, copyPayload, copyFormat }: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    const r = await p;
    if (!r.ok) return toast.error(r.error);
    toast.success(msg);
    router.refresh();
  };

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

  const exportHref = (format: "json" | "md" | "csv") =>
    `/api/export?scope=game&id=${game.id}&format=${format}`;
  const hasCover = Boolean(game.coverAttachmentId || game.coverUrl);

  return (
    <header className="mb-8 flex gap-4 sm:gap-5">
      <div className="group relative w-20 shrink-0 sm:w-36">
        <GameCover game={game} className="[container-type:inline-size] w-full" />
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
        <div className="mt-2 flex gap-1">
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
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-display text-[26px] leading-tight sm:text-[32px]">
              <span className="truncate">{game.name}</span>
              {game.isFavorite ? (
                <Star className="size-5 shrink-0 fill-accent text-accent" aria-label="Favorite" />
              ) : null}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
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
            {game.notes ? (
              <p className="mt-3 max-w-prose text-[13px] whitespace-pre-line text-ink-2">
                {game.notes}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {presetCount > 0 ? (
              <CopyMenu
                getPayload={() => copyPayload}
                defaultFormat={copyFormat}
                what="the whole game"
                label="Copy all"
              />
            ) : null}
            {presetCount >= 2 ? (
              <Button asChild variant="secondary">
                <Link href={`/games/${game.slug}/compare`}>
                  <GitCompare /> Compare
                </Link>
              </Button>
            ) : null}
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
          </div>
        </div>
      </div>

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
    </header>
  );
}
