"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCategoryAction, updateCategoryAction } from "@/lib/actions/settings";
import type { Category } from "@/lib/db/schema";
import { CATEGORY_ICONS, guessIcon } from "@/lib/settings/icons";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

const SUGGESTED = [
  "Controls",
  "Mouse",
  "Keyboard",
  "Controller",
  "Graphics",
  "Display",
  "Audio",
  "Camera",
  "Gameplay",
  "Accessibility",
  "Interface",
  "Network",
  "HUD",
  "Performance",
  "Advanced",
];

export function CategoryDialog({
  open,
  onOpenChange,
  presetId,
  category,
  existingNames = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetId: string;
  category?: Category | null;
  existingNames?: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={category ? "Rename category" : "Add a category"} size="sm">
        <CategoryForm
          presetId={presetId}
          category={category}
          existingNames={existingNames}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  presetId,
  category,
  existingNames,
  onDone,
}: {
  presetId: string;
  category?: Category | null;
  existingNames: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState(category?.name ?? "");
  const [icon, setIcon] = React.useState<string | null>(category?.icon ?? null);
  const [touchedIcon, setTouchedIcon] = React.useState(Boolean(category?.icon));
  const [error, setError] = React.useState<string | null>(null);

  const changeName = (v: string) => {
    setName(v);
    if (!touchedIcon) setIcon(guessIcon(v));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const input = { name, icon };
      const result = category
        ? await updateCategoryAction(category.id, input)
        : await createCategoryAction(presetId, input);
      if (!result.ok) {
        setError(result.fieldErrors?.["input.name"] ?? result.error);
        return;
      }
      toast.success(category ? "Category renamed" : "Category added");
      onDone();
      router.refresh();
    });
  };

  const remaining = SUGGESTED.filter((s) => !existingNames.includes(s));

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="category-name" error={error}>
        <Input
          id="category-name"
          value={name}
          onChange={(e) => changeName(e.target.value)}
          placeholder="Controls"
          autoFocus
          required
          maxLength={80}
          aria-invalid={!!error}
        />
      </Field>
      {!category && remaining.length > 0 ? (
        <div className="-mt-2 flex flex-wrap gap-1">
          {remaining.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeName(s)}
              className="h-6 cursor-pointer rounded-xs border border-dashed border-line px-2 text-xs text-ink-3 hover:border-line-strong hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <Field label="Icon" htmlFor="category-icon" optional>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Icon">
          {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={icon === key}
              aria-label={key}
              onClick={() => {
                setTouchedIcon(true);
                setIcon(icon === key ? null : key);
              }}
              className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-sm border transition-colors",
                icon === key
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {category ? "Save" : "Add category"}
        </Button>
      </DialogFooter>
    </form>
  );
}
