import { valueSchemaFor, type SettingDefinition, type SettingValue } from "./types";

const TRUE = new Set(["on", "yes", "true", "enabled", "1"]);
const FALSE = new Set(["off", "no", "false", "disabled", "0"]);
const NUMBER = /-?\d+(?:[.,]\d+)?/;
const RESOLUTION = /(\d{3,5})\s*[x×*]\s*(\d{3,5})/i;
const HEX = /^#?([0-9a-f]{6})$/i;

/**
 * Turns on-screen text ("On", "1920x1080", "High") into a typed value for `def`.
 * Null when the text can't be read as that type or fails the definition's own rules.
 */
export function coerceValue(def: SettingDefinition, raw: string): SettingValue | null {
  const text = raw.trim();
  if (!text) return null;
  const value = parse(def, text);
  if (value == null) return null;
  return valueSchemaFor(def).safeParse(value).success ? value : null;
}

function parse(def: SettingDefinition, text: string): SettingValue | null {
  const lower = text.toLowerCase();
  switch (def.type) {
    case "boolean":
      return TRUE.has(lower) ? true : FALSE.has(lower) ? false : null;
    case "integer":
    case "decimal":
    case "slider":
    case "percentage": {
      const m = NUMBER.exec(text);
      if (!m) return null;
      // ponytail: a single comma is read as a decimal separator ("0,85"); "1,000" becomes 1.
      const n = Number(m[0].replace(",", "."));
      if (!Number.isFinite(n)) return null;
      return def.type === "integer" && !Number.isInteger(n) ? null : n;
    }
    case "dropdown":
    case "enum":
      return option(def, text);
    case "multi_select": {
      const parts = text.split(",").map((p) => option(def, p.trim()));
      return parts.every((p): p is string => p != null) ? parts : null;
    }
    case "resolution": {
      const m = RESOLUTION.exec(text);
      return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
    }
    case "color": {
      const m = HEX.exec(text);
      return m ? `#${m[1]!.toLowerCase()}` : null;
    }
    case "text":
    case "long_text":
    case "keybind":
    case "controller_binding":
    case "info":
      return text;
  }
}

/** Case and spacing never matter; a trailing note the game adds, like "(Recommended)", may. */
function option(def: SettingDefinition, text: string): string | null {
  const options = def.options ?? [];
  if (options.length === 0) return text;
  const flat = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const find = (t: string) =>
    options.find((o) => flat(o.label) === t || flat(o.value) === t)?.value ?? null;
  return find(flat(text)) ?? find(flat(text.replace(/\([^)]*\)\s*$/, "")));
}
