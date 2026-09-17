/**
 * Turns a game's config files into a PresetDoc (the catalog is the map) and back.
 * Files are patched, never generated: `writeGameConfig` needs the originals.
 */
import type { CatalogFile, CatalogGame, CatalogSetting, SettingSource } from "@/lib/catalog";
import type { PresetDoc, SettingDoc } from "@/lib/import-export/schema";
import type { SettingValue } from "@/lib/settings/types";
import { parseKeyValues, patchKeyValues, type KVNode } from "./formats/keyvalues";
import { parseIni, patchIni } from "./formats/ini";

export type ConfigFiles = Partial<Record<string, string>>;
export type ReadResult = {
  preset: PresetDoc;
  missingFiles: string[];
  unmappedSettings: string[];
  warnings: string[];
};
export type WriteResult = {
  files: Record<string, string>;
  changed: Record<string, Record<string, string>>;
  skipped: string[];
};

/** Flat key → value for the file's declared section. */
function sectionValues(file: CatalogFile, text: string): Record<string, string> {
  if (file.format === "ini") return parseIni(text)[file.section[0] ?? ""] ?? {};
  let node: KVNode | string | undefined = parseKeyValues(text);
  for (const part of file.section) node = typeof node === "object" ? node[part] : undefined;
  const out: Record<string, string> = {};
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) if (typeof v === "string") out[k] = v;
  }
  return out;
}

const TRUE = new Set(["1", "true", "True", "TRUE"]);
const FALSE = new Set(["0", "false", "False", "FALSE"]);

function decode(setting: CatalogSetting, raw: string): SettingValue | undefined {
  switch (setting.type) {
    case "boolean":
      return TRUE.has(raw) ? true : FALSE.has(raw) ? false : undefined;
    case "integer":
    case "decimal":
    case "slider":
    case "percentage": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case "dropdown":
    case "enum":
      return setting.options?.some((o) => o.value === raw) ? raw : undefined;
    default:
      return raw;
  }
}

function encode(file: CatalogFile, value: SettingValue): string {
  if (typeof value === "boolean") {
    if (file.bool === "01") return value ? "1" : "0";
    if (file.bool === "truefalse") return value ? "true" : "false";
    return value ? "True" : "False";
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "object") return `${value.width}x${value.height}`;
  return value;
}

function readOne(
  s: CatalogSetting,
  source: SettingSource,
  vals: Record<string, string>,
  warnings: string[],
  label: string,
): SettingValue | undefined {
  if ("key" in source) {
    const raw = vals[source.key];
    if (raw === undefined) return undefined;
    const v = decode(s, raw);
    if (v === undefined) warnings.push(`${label}: unexpected value "${raw}" for ${source.key}`);
    return v;
  }
  if ("width" in source) {
    const w = Number(vals[source.width]);
    const h = Number(vals[source.height]);
    return w > 0 && h > 0 ? { width: w, height: h } : undefined;
  }
  if ("match" in source) {
    const hit = source.match.find((m) => Object.entries(m.keys).every(([k, v]) => vals[k] === v));
    const present = Object.keys(source.match[0]!.keys).some((k) => k in vals);
    if (!hit && present) warnings.push(`${label}: the file's values match none of the options`);
    return hit?.value;
  }
  // ponytail: a key rebound *away* from its command still reads as the default binding.
  return Object.entries(vals).find(([, cmd]) => cmd === source.bind)?.[0];
}

export function readGameConfig(game: CatalogGame, files: ConfigFiles): ReadResult {
  const template = game.presets[0]!;
  const warnings: string[] = [];
  const unmappedSettings: string[] = [];
  const missingFiles = game.files.filter((f) => files[f.id] == null).map((f) => f.id);
  const parsed = new Map<string, Record<string, string>>();
  for (const f of game.files) {
    const text = files[f.id];
    if (text == null) continue;
    try {
      parsed.set(f.id, sectionValues(f, text));
    } catch (e) {
      warnings.push(`${f.id}: could not parse (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  const categories = template.categories.map((c) => ({
    ...c,
    settings: c.settings.map((cs) => {
      const { source, ...s } = cs;
      const label = `${c.name} › ${s.name}`;
      if (!source) {
        unmappedSettings.push(label);
        return s;
      }
      const vals = parsed.get(source.file);
      if (!vals) return s;
      const v = readOne(cs, source, vals, warnings, label);
      return v === undefined ? s : { ...s, value: v };
    }),
  }));
  return { preset: { ...template, categories }, missingFiles, unmappedSettings, warnings };
}

export function writeGameConfig(
  game: CatalogGame,
  preset: PresetDoc,
  originals: ConfigFiles,
): WriteResult {
  const updates = new Map<string, Record<string, string>>();
  const skipped: string[] = [];
  const bySetting = new Map<string, SettingDoc>();
  for (const c of preset.categories)
    for (const s of c.settings) bySetting.set(`${c.name}/${s.name}`, s);

  for (const c of game.presets[0]!.categories) {
    for (const cs of c.settings) {
      const src = cs.source;
      if (!src) continue;
      const label = `${c.name} › ${cs.name}`;
      const file = game.files.find((f) => f.id === src.file)!;
      const original = originals[file.id];
      if (original == null) {
        skipped.push(`${label}: no ${file.id} file provided`);
        continue;
      }
      const s = bySetting.get(`${c.name}/${cs.name}`);
      if (!s || s.value == null) {
        skipped.push(`${label}: not in this preset`);
        continue;
      }
      let u = updates.get(file.id);
      if (!u) updates.set(file.id, (u = {}));
      if ("key" in src) {
        u[src.key] = encode(file, s.value);
      } else if ("width" in src) {
        if (typeof s.value === "object" && !Array.isArray(s.value)) {
          u[src.width] = String(s.value.width);
          u[src.height] = String(s.value.height);
        }
      } else if ("match" in src) {
        const m = src.match.find((o) => o.value === s.value);
        if (m) Object.assign(u, m.keys);
        else skipped.push(`${label}: "${String(s.value)}" has no file mapping`);
      } else {
        const key = String(s.value);
        const def = cs.defaultValue != null ? String(cs.defaultValue) : null;
        const current = sectionValues(file, original);
        if (key === def && current[key] === undefined) continue; // default and not overridden
        u[key] = src.bind;
        // ponytail: two settings moved onto the same key → last one wins, as in the game.
        if (def && def !== key && (current[def] === undefined || current[def] === src.bind)) {
          u[def] = "<unbound>";
        }
      }
    }
  }

  const files: Record<string, string> = {};
  for (const [id, u] of updates) {
    const f = game.files.find((x) => x.id === id)!;
    const text = originals[id]!;
    files[id] =
      f.format === "ini"
        ? patchIni(text, f.section[0] ?? "", u)
        : patchKeyValues(text, f.section, u);
  }
  return { files, changed: Object.fromEntries(updates), skipped };
}
