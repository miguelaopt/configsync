/**
 * Generic setting type system.
 *
 * A setting's `type` decides how its JSON `value` is validated, edited and displayed.
 * Adding a type = add it to SETTING_TYPES here + the `setting_type` enum in the DB schema.
 */
import { z } from "zod";

export const SETTING_TYPE_IDS = [
  "boolean",
  "integer",
  "decimal",
  "slider",
  "percentage",
  "text",
  "long_text",
  "dropdown",
  "enum",
  "multi_select",
  "keybind",
  "controller_binding",
  "color",
  "resolution",
  "info",
] as const;

export type SettingTypeId = (typeof SETTING_TYPE_IDS)[number];

export type Resolution = { width: number; height: number };
export type SettingValue = boolean | number | string | string[] | Resolution;
export type SettingOption = { label: string; value: string };

/** The subset of a setting that influences validation/formatting. */
export type SettingDefinition = {
  type: SettingTypeId;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  options?: SettingOption[] | null;
  unit?: string | null;
};

type TypeMeta = {
  label: string;
  group: "Basic" | "Numbers" | "Choices" | "Bindings" | "Other";
  hint: string;
  /** Whether the editor shows min/max/step fields. */
  hasRange: boolean;
  /** Whether the editor shows an options list. */
  hasOptions: boolean;
  defaultValue: (def: SettingDefinition) => SettingValue | null;
};

export const SETTING_TYPES: Record<SettingTypeId, TypeMeta> = {
  boolean: {
    label: "Toggle",
    group: "Basic",
    hint: "On or Off",
    hasRange: false,
    hasOptions: false,
    defaultValue: () => false,
  },
  text: {
    label: "Text",
    group: "Basic",
    hint: "Short free text",
    hasRange: false,
    hasOptions: false,
    defaultValue: () => "",
  },
  long_text: {
    label: "Long text",
    group: "Basic",
    hint: "Multi-line text",
    hasRange: false,
    hasOptions: false,
    defaultValue: () => "",
  },
  info: {
    label: "Info (read-only)",
    group: "Basic",
    hint: "Displayed, never edited in-game",
    hasRange: false,
    hasOptions: false,
    defaultValue: () => "",
  },
  integer: {
    label: "Whole number",
    group: "Numbers",
    hint: "e.g. 8",
    hasRange: true,
    hasOptions: false,
    defaultValue: (d) => d.min ?? 0,
  },
  decimal: {
    label: "Decimal",
    group: "Numbers",
    hint: "e.g. 0.85",
    hasRange: true,
    hasOptions: false,
    defaultValue: (d) => d.min ?? 0,
  },
  slider: {
    label: "Slider",
    group: "Numbers",
    hint: "Number with a visual range",
    hasRange: true,
    hasOptions: false,
    defaultValue: (d) => d.min ?? 0,
  },
  percentage: {
    label: "Percentage",
    group: "Numbers",
    hint: "0–100 %",
    hasRange: true,
    hasOptions: false,
    defaultValue: (d) => d.min ?? 0,
  },
  dropdown: {
    label: "Dropdown",
    group: "Choices",
    hint: "One option from a list",
    hasRange: false,
    hasOptions: true,
    defaultValue: (d) => d.options?.[0]?.value ?? "",
  },
  enum: {
    label: "Choice (segmented)",
    group: "Choices",
    hint: "Low / Medium / High …",
    hasRange: false,
    hasOptions: true,
    defaultValue: (d) => d.options?.[0]?.value ?? "",
  },
  multi_select: {
    label: "Multi-select",
    group: "Choices",
    hint: "Several options at once",
    hasRange: false,
    hasOptions: true,
    defaultValue: () => [],
  },
  keybind: {
    label: "Keybind",
    group: "Bindings",
    hint: "Keyboard / mouse binding",
    hasRange: false,
    hasOptions: false,
    defaultValue: () => "",
  },
  controller_binding: {
    label: "Controller button",
    group: "Bindings",
    hint: "e.g. RT, L3, D-Pad Up",
    hasRange: false,
    hasOptions: false,
    defaultValue: () => "",
  },
  color: {
    label: "Color",
    group: "Other",
    hint: "Hex color",
    hasRange: false,
    hasOptions: false,
    defaultValue: () => "#ffffff",
  },
  resolution: {
    label: "Resolution",
    group: "Other",
    hint: "Width × height",
    hasRange: false,
    hasOptions: false,
    defaultValue: () => ({ width: 1920, height: 1080 }),
  },
};

export const NUMERIC_TYPES: ReadonlySet<SettingTypeId> = new Set([
  "integer",
  "decimal",
  "slider",
  "percentage",
]);
export const CHOICE_TYPES: ReadonlySet<SettingTypeId> = new Set(["dropdown", "enum", "multi_select"]);

export const settingTypeSchema = z.enum(SETTING_TYPE_IDS);
export const settingOptionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
});
export const resolutionSchema = z.object({
  width: z.number().int().min(1).max(100_000),
  height: z.number().int().min(1).max(100_000),
});

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Builds the zod schema that a value must satisfy for a given definition. */
export function valueSchemaFor(def: SettingDefinition): z.ZodType<SettingValue> {
  const num = (integer: boolean, fallbackMin?: number, fallbackMax?: number) => {
    let s = z.number().finite();
    if (integer) s = s.int();
    const min = def.min ?? fallbackMin;
    const max = def.max ?? fallbackMax;
    if (min != null) s = s.min(min, `Must be at least ${min}`);
    if (max != null) s = s.max(max, `Must be at most ${max}`);
    return s;
  };
  const optionValues = (def.options ?? []).map((o) => o.value);
  const choice = () =>
    optionValues.length > 0
      ? z.string().refine((v) => optionValues.includes(v), { message: "Not one of the options" })
      : z.string().max(500);

  switch (def.type) {
    case "boolean":
      return z.boolean();
    case "integer":
      return num(true);
    case "decimal":
    case "slider":
      return num(false);
    case "percentage":
      return num(false, 0, 100);
    case "text":
    case "keybind":
    case "controller_binding":
    case "info":
      return z.string().max(500);
    case "long_text":
      return z.string().max(10_000);
    case "dropdown":
    case "enum":
      return choice();
    case "multi_select":
      return z.array(choice()).max(100);
    case "color":
      return z.string().regex(HEX_COLOR, "Use a hex color like #ff8800");
    case "resolution":
      return resolutionSchema;
  }
}

/** Human-readable value, used by the viewer, copy output and markdown export. */
export function formatValue(def: SettingDefinition, value: SettingValue | null | undefined): string {
  if (value == null || value === "") return "—";
  switch (def.type) {
    case "boolean":
      return value ? "On" : "Off";
    case "percentage":
      return `${formatNumber(value)}%`;
    case "integer":
    case "decimal":
    case "slider":
      return def.unit ? `${formatNumber(value)} ${def.unit}` : formatNumber(value);
    case "dropdown":
    case "enum":
      return optionLabel(def, String(value));
    case "multi_select":
      return Array.isArray(value)
        ? value.length === 0
          ? "—"
          : value.map((v) => optionLabel(def, v)).join(", ")
        : String(value);
    case "resolution":
      return isResolution(value) ? `${value.width}×${value.height}` : String(value);
    default:
      return String(value);
  }
}

function optionLabel(def: SettingDefinition, value: string) {
  return def.options?.find((o) => o.value === value)?.label ?? value;
}

function formatNumber(v: SettingValue) {
  return typeof v === "number" ? String(v) : String(v);
}

export function isResolution(v: unknown): v is Resolution {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Resolution).width === "number" &&
    typeof (v as Resolution).height === "number"
  );
}

/** Deep equality for setting values (primitives, string arrays, resolutions). */
export function valuesEqual(a: SettingValue | null | undefined, b: SettingValue | null | undefined) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (isResolution(a) && isResolution(b)) return a.width === b.width && a.height === b.height;
  return false;
}
