"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { createGameAction, updateGameAction } from "@/lib/actions/games";
import type { Game } from "@/lib/db/schema";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { CatalogPicker } from "./catalog-picker";
import { PLATFORM_SUGGESTIONS } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const ACCENT_SWATCHES = [
  "#e9b44c",
  "#59c48d",
  "#6fa8ff",
  "#e5655c",
  "#c084fc",
  "#f472b6",
  "#2dd4bf",
  "#fb923c",
  "#a3a3a3",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game?: Game | null;
  catalog?: PublicCatalogEntry[];
  owned?: string[];
};

/** Create/edit a game. Values stay in the form when a save fails. */
export function GameDialog({ open, onOpenChange, game, catalog, owned }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={game ? "Edit game" : "Add a game"}
        description={
          game
            ? undefined
            : "Pick a game from the catalog to get its real settings menu, or define your own."
        }
      >
        {!game && catalog?.length ? (
          <div className="mb-5 flex flex-col gap-2">
            <p className="text-[13px] font-medium text-ink">From the catalog</p>
            <CatalogPicker
              entries={catalog}
              owned={owned ?? []}
              onDone={() => onOpenChange(false)}
            />
            <p className="text-xs text-ink-3">Or create any game by hand below.</p>
          </div>
        ) : null}
        <GameForm game={game} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so state resets naturally between opens. */
function GameForm({ game, onDone }: { game?: Game | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState(game?.name ?? "");
  const [platforms, setPlatforms] = React.useState<string[]>(game?.platforms ?? []);
  const [tags, setTags] = React.useState<string[]>(game?.tags ?? []);
  const [accent, setAccent] = React.useState<string | null>(game?.accentColor ?? null);
  const [coverUrl, setCoverUrl] = React.useState(game?.coverUrl ?? "");
  const [notes, setNotes] = React.useState(game?.notes ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      name,
      platforms,
      tags,
      accentColor: accent,
      coverUrl: coverUrl || null,
      notes: notes || null,
    };
    startTransition(async () => {
      const result = game ? await updateGameAction(game.id, input) : await createGameAction(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(game ? "Game updated" : "Game added");
      onDone();
      if (game) router.refresh();
      else router.push(`/games/${result.data.slug}`);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="game-name" error={errors.name}>
        <Input
          id="game-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Skyline Drift"
          autoFocus
          required
          maxLength={120}
          aria-invalid={!!errors.name}
        />
      </Field>
      <Field label="Platforms" htmlFor="game-platforms" optional hint="Press Enter to add.">
        <TagInput
          id="game-platforms"
          value={platforms}
          onChange={setPlatforms}
          suggestions={PLATFORM_SUGGESTIONS}
          placeholder="PC, PlayStation 5…"
        />
      </Field>
      <Field label="Tags" htmlFor="game-tags" optional>
        <TagInput
          id="game-tags"
          value={tags}
          onChange={setTags}
          placeholder="shooter, competitive, co-op…"
        />
      </Field>
      <Field
        label="Accent color"
        htmlFor="game-accent"
        optional
        hint="Used for this game's pages and tiles."
      >
        <div
          className="flex flex-wrap items-center gap-2"
          role="radiogroup"
          aria-label="Accent color"
        >
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={accent === c}
              aria-label={c}
              onClick={() => setAccent(accent === c ? null : c)}
              className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-110",
                accent === c ? "border-ink" : "border-transparent",
              )}
              style={{ background: c }}
            >
              {accent === c ? <Check className="size-3.5 text-black/80" strokeWidth={3} /> : null}
            </button>
          ))}
          <input
            id="game-accent"
            type="color"
            value={accent ?? "#e9b44c"}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Custom accent color"
            className="size-7 cursor-pointer rounded-full border border-line bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0.5"
          />
        </div>
      </Field>
      <Field
        label="Cover image URL"
        htmlFor="game-cover"
        optional
        hint="https:// link to an image you have the rights to use. You can also upload one from the game page."
        error={errors.coverUrl}
      >
        <Input
          id="game-cover"
          type="url"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…"
          aria-invalid={!!errors.coverUrl}
        />
      </Field>
      <Field label="Notes" htmlFor="game-notes" optional>
        <Textarea
          id="game-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth remembering about this game's setup."
          rows={3}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {game ? "Save changes" : "Add game"}
        </Button>
      </DialogFooter>
    </form>
  );
}
