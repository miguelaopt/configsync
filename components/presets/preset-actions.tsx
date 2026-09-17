"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  EyeOff,
  FileCog,
  Globe,
  FileText,
  MoreHorizontal,
  Pencil,
  Star,
  Table,
  Trash2,
  CheckCircle2,
  History,
} from "lucide-react";
import type { Preset } from "@/lib/db/schema";
import type { PublicCatalogEntry } from "@/lib/catalog";
import {
  deletePresetAction,
  duplicatePresetAction,
  setDefaultPresetAction,
  setPresetArchivedAction,
  setPresetFavoriteAction,
  setPresetVisibilityAction,
} from "@/lib/actions/presets";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
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
import { PresetDialog } from "./preset-dialog";
import { ConfigFilesDialog } from "./config-files-dialog";
import { cn } from "@/lib/utils/cn";

type Props = {
  preset: Preset;
  gameSlug: string;
  siblings?: { id: string; name: string }[];
  /** The game's catalog entry, when it has one; enables "Game config files…". */
  catalogEntry?: PublicCatalogEntry | null;
  /** Called after delete when the current page is the preset itself. */
  onDeleted?: () => void;
  onShowHistory?: () => void;
  className?: string;
};

export function PresetActionsMenu({
  preset,
  gameSlug,
  siblings = [],
  catalogEntry,
  onDeleted,
  onShowHistory,
  className,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [configFiles, setConfigFiles] = React.useState(false);

  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    const r = await p;
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(msg);
    router.refresh();
    return true;
  };

  const exportHref = (format: "json" | "md" | "csv") =>
    `/api/export?scope=preset&id=${preset.id}&format=${format}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${preset.name}`}
            className={cn("text-ink-3", className)}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Edit details
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              const r = await duplicatePresetAction(preset.id);
              if (!r.ok) return toast.error(r.error);
              toast.success("Preset duplicated");
              router.push(`/games/${gameSlug}/${r.data.slug}`);
            }}
          >
            <Copy /> Duplicate
          </DropdownMenuItem>
          {!preset.isDefault ? (
            <DropdownMenuItem
              onSelect={() => run(setDefaultPresetAction(preset.id), "Set as default")}
            >
              <CheckCircle2 /> Set as default
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() =>
              run(
                setPresetFavoriteAction(preset.id, !preset.isFavorite),
                preset.isFavorite ? "Removed from favorites" : "Added to favorites",
              )
            }
          >
            <Star className={cn(preset.isFavorite && "fill-current")} />{" "}
            {preset.isFavorite ? "Unfavorite" : "Favorite"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              run(
                setPresetVisibilityAction(preset.id, preset.visibility !== "public"),
                preset.visibility === "public" ? "Preset is private again" : "Preset is public",
              )
            }
          >
            {preset.visibility === "public" ? <EyeOff /> : <Globe />}{" "}
            {preset.visibility === "public" ? "Make private" : "Make public"}
          </DropdownMenuItem>
          {onShowHistory ? (
            <DropdownMenuItem onSelect={onShowHistory}>
              <History /> History
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download /> Export
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
          {catalogEntry?.files.length ? (
            <DropdownMenuItem onSelect={() => setConfigFiles(true)}>
              <FileCog /> Game config files…
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() =>
              run(
                setPresetArchivedAction(preset.id, !preset.isArchived),
                preset.isArchived ? "Preset restored" : "Preset archived",
              )
            }
          >
            {preset.isArchived ? <ArchiveRestore /> : <Archive />}{" "}
            {preset.isArchived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
            <Trash2 /> Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PresetDialog
        open={editing}
        onOpenChange={setEditing}
        gameId={preset.gameId}
        gameSlug={gameSlug}
        preset={preset}
        siblings={siblings}
      />
      {catalogEntry ? (
        <ConfigFilesDialog
          open={configFiles}
          onOpenChange={setConfigFiles}
          presetId={preset.id}
          entry={catalogEntry}
        />
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${preset.name}”?`}
        description="All of its categories, settings and history are removed. Export it first if you might want it back."
        confirmLabel="Delete preset"
        onConfirm={async () => {
          const ok = await run(deletePresetAction(preset.id), "Preset deleted");
          if (ok) onDeleted?.();
        }}
      />
    </>
  );
}
