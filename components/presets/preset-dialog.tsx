"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPresetAction, updatePresetAction } from "@/lib/actions/presets";
import type { Preset } from "@/lib/db/schema";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

const PRESET_SUGGESTIONS = [
  "competitive",
  "casual",
  "controller",
  "keyboard & mouse",
  "1440p",
  "4k",
  "laptop",
  "high fps",
  "quality",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: string;
  gameSlug: string;
  preset?: Preset | null;
  /** Existing presets, offered as "copy of" sources. */
  siblings?: { id: string; name: string }[];
};

export function PresetDialog({
  open,
  onOpenChange,
  gameId,
  gameSlug,
  preset,
  siblings = [],
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={preset ? "Edit preset" : "New preset"}
        description={
          preset
            ? undefined
            : "A preset is one complete set of settings — Main Setup, Competitive, Controller…"
        }
      >
        <PresetForm
          gameId={gameId}
          gameSlug={gameSlug}
          preset={preset}
          siblings={siblings}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PresetForm({
  gameId,
  gameSlug,
  preset,
  siblings,
  onDone,
}: {
  gameId: string;
  gameSlug: string;
  preset?: Preset | null;
  siblings: { id: string; name: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState(preset?.name ?? "");
  const [description, setDescription] = React.useState(preset?.description ?? "");
  const [notes, setNotes] = React.useState(preset?.notes ?? "");
  const [tags, setTags] = React.useState<string[]>(preset?.tags ?? []);
  const [start, setStart] = React.useState<"starter" | "empty" | "copy">(
    siblings.length ? "copy" : "starter",
  );
  const [fromId, setFromId] = React.useState(siblings[0]?.id ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { name, description: description || null, notes: notes || null, tags };
    startTransition(async () => {
      const result = preset
        ? await updatePresetAction(preset.id, input)
        : await createPresetAction({
            gameId,
            input,
            start,
            fromPresetId: start === "copy" ? fromId : undefined,
          });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(preset ? "Preset updated" : "Preset created");
      onDone();
      if (preset) router.refresh();
      else router.push(`/games/${gameSlug}/${result.data.slug}`);
    });
  };

  const startOptions: { value: typeof start; label: string; hint: string }[] = [
    ...(siblings.length
      ? [
          {
            value: "copy" as const,
            label: "Copy of a preset",
            hint: "Same categories and values, ready to tweak.",
          },
        ]
      : []),
    {
      value: "starter",
      label: "Starter categories",
      hint: "Controls, Display, Graphics, Audio, Gameplay — empty.",
    },
    { value: "empty", label: "Empty", hint: "Build the structure yourself." },
  ];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="preset-name" error={errors.name}>
        <Input
          id="preset-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Main Setup"
          autoFocus
          required
          maxLength={80}
          aria-invalid={!!errors.name}
        />
      </Field>

      {!preset ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium">Start from</legend>
          {startOptions.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-sm border px-3 py-2.5 transition-colors",
                start === o.value
                  ? "border-accent bg-accent-soft/40"
                  : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="start"
                value={o.value}
                checked={start === o.value}
                onChange={() => setStart(o.value)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">{o.label}</span>
                <span className="block text-xs text-ink-2">{o.hint}</span>
              </span>
            </label>
          ))}
          {start === "copy" && siblings.length > 0 ? (
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger aria-label="Preset to copy" className="mt-1">
                <SelectValue placeholder="Choose a preset" />
              </SelectTrigger>
              <SelectContent>
                {siblings.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </fieldset>
      ) : null}

      <Field label="Description" htmlFor="preset-description" optional>
        <Input
          id="preset-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="When do you use this preset?"
          maxLength={500}
        />
      </Field>
      <Field label="Tags" htmlFor="preset-tags" optional>
        <TagInput
          id="preset-tags"
          value={tags}
          onChange={setTags}
          suggestions={PRESET_SUGGESTIONS}
          placeholder="controller, 1440p…"
        />
      </Field>
      {preset ? (
        <Field label="Notes" htmlFor="preset-notes" optional>
          <Textarea
            id="preset-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Why these values work, what to try next…"
          />
        </Field>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {preset ? "Save changes" : "Create preset"}
        </Button>
      </DialogFooter>
    </form>
  );
}
