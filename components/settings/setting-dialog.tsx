"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { createSettingAction, updateSettingAction } from "@/lib/actions/settings";
import type { Setting } from "@/lib/db/schema";
import {
  SETTING_TYPES,
  SETTING_TYPE_IDS,
  valueSchemaFor,
  type SettingOption,
  type SettingTypeId,
  type SettingValue,
} from "@/lib/settings/types";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingControl } from "./setting-control";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  categoryId: string;
  setting?: Setting | null;
};

const GROUPS = ["Basic", "Numbers", "Choices", "Bindings", "Other"] as const;

/** Create/edit a setting definition. The value control previews the chosen type live. */
export function SettingDialog({ open, onOpenChange, categories, categoryId, setting }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={setting ? "Edit setting" : "Add a setting"}
        size="lg"
        description={
          setting ? undefined : "Name it exactly as the game does, so it's easy to find later."
        }
      >
        <SettingForm
          categories={categories}
          categoryId={categoryId}
          setting={setting}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SettingForm({
  categories,
  categoryId,
  setting,
  onDone,
}: {
  categories: { id: string; name: string }[];
  categoryId: string;
  setting?: Setting | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState(setting?.name ?? "");
  const [type, setType] = React.useState<SettingTypeId>(setting?.type ?? "boolean");
  const [category, setCategory] = React.useState(setting?.categoryId ?? categoryId);
  const [description, setDescription] = React.useState(setting?.description ?? "");
  const [unit, setUnit] = React.useState(setting?.unit ?? "");
  const [min, setMin] = React.useState(setting?.min != null ? String(setting.min) : "");
  const [max, setMax] = React.useState(setting?.max != null ? String(setting.max) : "");
  const [step, setStep] = React.useState(setting?.step != null ? String(setting.step) : "");
  const [options, setOptions] = React.useState<SettingOption[]>(setting?.options ?? []);
  const [value, setValue] = React.useState<SettingValue | null>(
    (setting?.value as SettingValue | null) ?? (setting ? null : false),
  );
  const [defaultValue, setDefaultValue] = React.useState<SettingValue | null>(
    (setting?.defaultValue as SettingValue | null) ?? null,
  );
  const [notes, setNotes] = React.useState(setting?.notes ?? "");

  const meta = SETTING_TYPES[type];
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const def = { type, min: num(min), max: num(max), step: num(step), options, unit: unit || null };

  // When the type changes, reset values that no longer fit (keeps the form honest).
  const changeType = (t: SettingTypeId) => {
    setType(t);
    const nextDef = { ...def, type: t };
    if (value != null && !valueSchemaFor(nextDef).safeParse(value).success)
      setValue(SETTING_TYPES[t].defaultValue(nextDef));
    if (defaultValue != null && !valueSchemaFor(nextDef).safeParse(defaultValue).success)
      setDefaultValue(null);
    if (value == null) setValue(SETTING_TYPES[t].defaultValue(nextDef));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      categoryId: category,
      name,
      type,
      value: value ?? SETTING_TYPES[type].defaultValue(def),
      description: description || null,
      unit: unit || null,
      min: def.min,
      max: def.max,
      step: def.step,
      defaultValue,
      options: meta.hasOptions ? options.filter((o) => o.label.trim() && o.value.trim()) : null,
      notes: notes || null,
    };
    startTransition(async () => {
      const result = setting
        ? await updateSettingAction(setting.id, { ...input })
        : await createSettingAction(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(setting ? "Setting updated" : "Setting added");
      onDone();
      router.refresh();
    });
  };

  const setOption = (i: number, patch: Partial<SettingOption>) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="setting-name" error={errors.name} className="sm:col-span-2">
        <Input
          id="setting-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. ADS Sensitivity"
          autoFocus
          required
          maxLength={120}
          aria-invalid={!!errors.name}
        />
      </Field>

      <Field label="Type" htmlFor="setting-type">
        <Select value={type} onValueChange={(v) => changeType(v as SettingTypeId)}>
          <SelectTrigger id="setting-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((g) => (
              <SelectGroup key={g}>
                <SelectLabel>{g}</SelectLabel>
                {SETTING_TYPE_IDS.filter((t) => SETTING_TYPES[t].group === g).map((t) => (
                  <SelectItem key={t} value={t}>
                    {SETTING_TYPES[t].label}
                    <span className="ml-2 text-xs text-ink-3">{SETTING_TYPES[t].hint}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Category" htmlFor="setting-category">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="setting-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {meta.hasRange ? (
        <div className="grid grid-cols-3 gap-2 sm:col-span-2 sm:grid-cols-4">
          <Field label="Min" htmlFor="setting-min" optional error={errors.min}>
            <Input
              id="setting-min"
              type="number"
              inputMode="decimal"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="tnum"
              aria-invalid={!!errors.min}
            />
          </Field>
          <Field label="Max" htmlFor="setting-max" optional>
            <Input
              id="setting-max"
              type="number"
              inputMode="decimal"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="tnum"
            />
          </Field>
          <Field label="Step" htmlFor="setting-step" optional>
            <Input
              id="setting-step"
              type="number"
              inputMode="decimal"
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className="tnum"
              placeholder={type === "decimal" ? "0.1" : "1"}
            />
          </Field>
          {type !== "percentage" ? (
            <Field label="Unit" htmlFor="setting-unit" optional>
              <Input
                id="setting-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ms, dpi, fps"
                maxLength={20}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {meta.hasOptions ? (
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-[13px] font-medium">Options</legend>
          <div className="flex flex-col gap-1.5">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <GripVertical className="size-4 shrink-0 text-ink-3" aria-hidden />
                <Input
                  aria-label={`Option ${i + 1} label`}
                  value={o.label}
                  onChange={(e) =>
                    setOption(i, {
                      label: e.target.value,
                      value:
                        o.value === slugLike(o.label) || !o.value
                          ? slugLike(e.target.value)
                          : o.value,
                    })
                  }
                  placeholder="Label (Ultra)"
                  maxLength={120}
                />
                <Input
                  aria-label={`Option ${i + 1} value`}
                  value={o.value}
                  onChange={(e) => setOption(i, { value: e.target.value })}
                  placeholder="value"
                  className="w-32 font-mono text-xs"
                  maxLength={120}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setOptions((prev) => [...prev, { label: "", value: "" }])}
            >
              <Plus /> Add option
            </Button>
          </div>
        </fieldset>
      ) : null}

      <Field label="Current value" htmlFor="setting-value" className="sm:col-span-2">
        <div className="rounded-sm border border-line bg-surface px-3 py-2.5">
          <SettingControl
            def={def}
            value={value}
            onChange={setValue}
            id="setting-value"
            label={name || "Value"}
            layout="full"
          />
        </div>
      </Field>

      <Field
        label="Default value"
        htmlFor="setting-default"
        optional
        hint="Used by “Reset to default”."
        className="sm:col-span-2"
      >
        {defaultValue == null ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setDefaultValue(value ?? SETTING_TYPES[type].defaultValue(def))}
          >
            Use current value as default
          </Button>
        ) : (
          <div className="flex items-start gap-2 rounded-sm border border-line bg-surface px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <SettingControl
                def={def}
                value={defaultValue}
                onChange={setDefaultValue}
                id="setting-default"
                label={`${name || "Setting"} default`}
                layout="full"
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDefaultValue(null)}>
              Clear
            </Button>
          </div>
        )}
      </Field>

      <Field label="Description" htmlFor="setting-description" optional className="sm:col-span-2">
        <Input
          id="setting-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Shown under the name"
          maxLength={500}
        />
      </Field>
      <Field label="Notes" htmlFor="setting-notes" optional className="sm:col-span-2">
        <Textarea
          id="setting-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Why this value, what you've tried…"
          maxLength={2000}
        />
      </Field>

      <DialogFooter className="sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {setting ? "Save changes" : "Add setting"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function slugLike(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
