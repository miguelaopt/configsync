"use client";
import * as React from "react";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { Popover } from "radix-ui";
import {
  formatValue,
  isResolution,
  type SettingDefinition,
  type SettingValue,
} from "@/lib/settings/types";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input, Textarea, inputClass } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils/cn";

type Props = {
  def: SettingDefinition;
  value: SettingValue | null | undefined;
  onChange: (value: SettingValue | null) => void;
  id: string;
  label: string;
  disabled?: boolean;
  /** Compact = inline row control; full = inside a dialog with more room. */
  layout?: "row" | "full";
};

/** Wide controls stack under the label on phones; compact ones stay inline. */
export function isWideControl(type: SettingDefinition["type"]) {
  return [
    "slider",
    "percentage",
    "long_text",
    "resolution",
    "text",
    "keybind",
    "controller_binding",
    "info",
    "dropdown",
    "multi_select",
    "color",
  ].includes(type);
}

export function SettingControl({
  def,
  value,
  onChange,
  id,
  label,
  disabled,
  layout = "row",
}: Props) {
  const full = layout === "full";
  switch (def.type) {
    case "boolean":
      return (
        <span className="inline-flex items-center gap-2">
          <span
            className={cn("tnum w-6 text-right text-[13px]", value ? "text-ink" : "text-ink-3")}
            aria-hidden
          >
            {value ? "On" : "Off"}
          </span>
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(v)}
            aria-label={label}
            disabled={disabled}
          />
        </span>
      );

    case "integer":
    case "decimal":
      return (
        <NumberStepper
          id={id}
          label={label}
          def={def}
          value={typeof value === "number" ? value : null}
          onChange={onChange}
          disabled={disabled}
          integer={def.type === "integer"}
        />
      );

    case "slider":
    case "percentage": {
      const min = def.min ?? 0;
      const max = def.max ?? (def.type === "percentage" ? 100 : 100);
      const step =
        def.step ??
        (def.type === "percentage" ? 1 : Number.isInteger(min) && Number.isInteger(max) ? 1 : 0.1);
      const num = typeof value === "number" ? value : min;
      return (
        <div className={cn("flex w-full items-center gap-3", full ? "" : "sm:w-64")}>
          <Slider
            id={id}
            aria-label={label}
            min={min}
            max={max}
            step={step}
            value={[num]}
            onValueChange={([v]) => onChange(v ?? min)}
            disabled={disabled}
            className="flex-1"
          />
          <NumberField
            aria-label={`${label} value`}
            value={num}
            min={min}
            max={max}
            step={step}
            onChange={(v) => onChange(v)}
            disabled={disabled}
            suffix={def.type === "percentage" ? "%" : (def.unit ?? undefined)}
            className="w-20"
          />
        </div>
      );
    }

    case "text":
    case "controller_binding":
      return (
        <Input
          id={id}
          aria-label={label}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn("w-full", !full && "sm:w-56")}
          placeholder={def.type === "controller_binding" ? "RT, L3, D-Pad Up…" : undefined}
          maxLength={500}
        />
      );

    case "keybind":
      return (
        <KeybindInput
          id={id}
          label={label}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          disabled={disabled}
          className={cn("w-full", !full && "sm:w-56")}
        />
      );

    case "info":
      return (
        <span className="tnum block max-w-full text-[13px] break-words text-ink-2">
          {typeof value === "string" && value ? value : "—"}
        </span>
      );

    case "long_text":
      return (
        <Textarea
          id={id}
          aria-label={label}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={full ? 5 : 2}
          className={cn("w-full", !full && "sm:w-72")}
          maxLength={10_000}
        />
      );

    case "enum":
    case "dropdown": {
      const options = def.options ?? [];
      const str = typeof value === "string" ? value : "";
      if (
        def.type === "enum" &&
        options.length > 0 &&
        options.length <= 5 &&
        options.every((o) => o.label.length <= 12)
      ) {
        return (
          <Segmented
            aria-label={label}
            value={str}
            onValueChange={onChange}
            options={options}
            className={cn("max-w-full", disabled && "opacity-50")}
          />
        );
      }
      if (options.length === 0) {
        return (
          <Input
            id={id}
            aria-label={label}
            value={str}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Add options via Edit"
            className={cn("w-full", !full && "sm:w-56")}
          />
        );
      }
      return (
        <Select value={str} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id} aria-label={label} className={cn("w-full", !full && "sm:w-56")}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "multi_select": {
      const options = def.options ?? [];
      const arr = Array.isArray(value) ? value : [];
      return (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              id={id}
              aria-label={label}
              disabled={disabled}
              className={cn(
                inputClass,
                "flex cursor-pointer items-center justify-between gap-2 text-left",
                !full && "sm:w-56",
              )}
            >
              <span className={cn("truncate", arr.length === 0 && "text-ink-3")}>
                {arr.length ? formatValue(def, arr) : "None selected"}
              </span>
              <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={4}
              className="z-50 w-64 rounded-md border border-line bg-overlay p-1 shadow-menu data-[state=open]:animate-fade-in"
            >
              {options.length === 0 ? (
                <p className="px-2 py-3 text-xs text-ink-3">No options yet. Add them via Edit.</p>
              ) : (
                options.map((o) => {
                  const checked = arr.includes(o.value);
                  const cid = `${id}-${o.value}`;
                  return (
                    <label
                      key={o.value}
                      htmlFor={cid}
                      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-xs px-2 text-sm hover:bg-raised"
                    >
                      <Checkbox
                        id={cid}
                        checked={checked}
                        onCheckedChange={(c) =>
                          onChange(c ? [...arr, o.value] : arr.filter((v) => v !== o.value))
                        }
                      />
                      {o.label}
                    </label>
                  );
                })
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      );
    }

    case "color": {
      const hex = typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff";
      return (
        <div className={cn("flex w-full items-center gap-2", !full && "sm:w-56")}>
          <input
            type="color"
            aria-label={`${label} picker`}
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="size-9 shrink-0 cursor-pointer rounded-sm border border-line bg-transparent p-0.5 [&::-webkit-color-swatch]:rounded-xs [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
          />
          <Input
            id={id}
            aria-label={label}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="#ff8800"
            className="font-mono uppercase"
            maxLength={9}
            spellCheck={false}
          />
        </div>
      );
    }

    case "resolution": {
      const res = isResolution(value) ? value : { width: 1920, height: 1080 };
      const presets = [
        [1280, 720],
        [1920, 1080],
        [2560, 1440],
        [3440, 1440],
        [3840, 2160],
      ];
      return (
        <div className={cn("flex w-full items-center gap-1.5", !full && "sm:w-64")}>
          <NumberField
            aria-label={`${label} width`}
            value={res.width}
            min={1}
            max={100000}
            step={1}
            onChange={(w) => onChange({ width: Math.round(w), height: res.height })}
            disabled={disabled}
            className="w-full"
          />
          <span className="text-ink-3" aria-hidden>
            ×
          </span>
          <NumberField
            aria-label={`${label} height`}
            value={res.height}
            min={1}
            max={100000}
            step={1}
            onChange={(h) => onChange({ width: res.width, height: Math.round(h) })}
            disabled={disabled}
            className="w-full"
          />
          <Select
            value={`${res.width}x${res.height}`}
            onValueChange={(v) => {
              const [w, h] = v.split("x").map(Number);
              onChange({ width: w!, height: h! });
            }}
            disabled={disabled}
          >
            <SelectTrigger
              aria-label="Common resolutions"
              className="w-9 shrink-0 justify-center px-0 [&>span]:hidden"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="min-w-36">
              {presets.map(([w, h]) => (
                <SelectItem key={`${w}x${h}`} value={`${w}x${h}`}>
                  {w}×{h}
                </SelectItem>
              ))}
              {!presets.some(([w, h]) => w === res.width && h === res.height) ? (
                <SelectItem value={`${res.width}x${res.height}`}>
                  {res.width}×{res.height}
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      );
    }
  }
}

// -----------------------------------------------------------------------------

function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  className,
  disabled,
  ...aria
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  disabled?: boolean;
  "aria-label": string;
}) {
  const [text, setText] = React.useState(String(value));
  const [seen, setSeen] = React.useState(value);
  if (seen !== value) {
    // Prop changed (slider drag, reset): resync the text field during render.
    setSeen(value);
    setText(String(value));
  }
  const commit = () => {
    const n = Number(text);
    if (text.trim() === "" || Number.isNaN(n)) return setText(String(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    onChange(clamped);
    setText(String(clamped));
  };
  return (
    <div className={cn("relative", className)}>
      <input
        type="number"
        inputMode="decimal"
        {...aria}
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={cn(inputClass, "tnum text-right", suffix && "pr-7")}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-ink-3">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function NumberStepper({
  id,
  label,
  def,
  value,
  onChange,
  disabled,
  integer,
}: {
  id: string;
  label: string;
  def: SettingDefinition;
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
  integer: boolean;
}) {
  const step = def.step ?? (integer ? 1 : 0.1);
  const current = value ?? def.min ?? 0;
  const decimals = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const bump = (dir: 1 | -1) => {
    const next = Number((current + dir * step).toFixed(decimals));
    onChange(Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, next)));
  };
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={disabled || (def.min != null && current <= def.min)}
        aria-label={`Decrease ${label}`}
        className="flex size-8 cursor-pointer items-center justify-center rounded-sm border border-line text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-40"
      >
        <Minus className="size-3.5" />
      </button>
      <NumberField
        aria-label={label}
        value={current}
        min={def.min ?? undefined}
        max={def.max ?? undefined}
        step={step}
        onChange={onChange}
        disabled={disabled}
        suffix={def.unit ?? undefined}
        className="w-24"
      />
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={disabled || (def.max != null && current >= def.max)}
        aria-label={`Increase ${label}`}
        className="flex size-8 cursor-pointer items-center justify-center rounded-sm border border-line text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-40"
      >
        <Plus className="size-3.5" />
      </button>
      <span className="sr-only" id={id} />
    </div>
  );
}

const KEY_NAMES: Record<string, string> = {
  " ": "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  Control: "Ctrl",
};

/** Text input that can also record a key combo when focused and you press keys. */
function KeybindInput({
  id,
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [recording, setRecording] = React.useState(false);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!recording) return;
    e.preventDefault();
    if (e.key === "Escape") return setRecording(false);
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
    const parts = [
      e.ctrlKey && "Ctrl",
      e.altKey && "Alt",
      e.shiftKey && "Shift",
      e.metaKey && "Cmd",
    ].filter(Boolean) as string[];
    const key = KEY_NAMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
    onChange([...parts, key].join("+"));
    setRecording(false);
  };
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        aria-label={label}
        value={recording ? "" : value}
        placeholder={recording ? "Press a key…" : "e.g. Ctrl+Shift+F, Mouse4"}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => {
          if (recording && e.button > 0) {
            e.preventDefault();
            onChange(`Mouse${e.button + 1}`);
            setRecording(false);
          }
        }}
        onBlur={() => setRecording(false)}
        disabled={disabled}
        className={cn("pr-16", recording && "border-accent")}
        maxLength={500}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setRecording((r) => !r)}
        disabled={disabled}
        className={cn(
          "absolute top-1/2 right-1.5 flex h-6 -translate-y-1/2 cursor-pointer items-center gap-1 rounded-xs px-1.5 text-[11px] font-medium",
          recording ? "bg-accent text-accent-ink" : "bg-raised text-ink-2 hover:text-ink",
        )}
      >
        {recording ? <Check className="size-3" /> : null}
        {recording ? "Listening" : "Record"}
      </button>
    </div>
  );
}
