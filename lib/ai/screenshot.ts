import { coerceValue } from "@/lib/settings/coerce";
import type { SettingDefinition, SettingValue } from "@/lib/settings/types";
import type { HintSetting, ProposedSetting, ScreenshotHints } from "@/lib/providers/screenshot";
import type { CatalogGame, CatalogMenuSetting } from "@/lib/catalog/schema";
import type { CategoryWithSettings } from "@/lib/data/presets";

// No runtime server imports here: the review dialog calls mergeRows in the browser.

/**
 * One reviewable line. `source` says where its definition came from: an existing setting of the
 * preset (settingId set), the catalog's menu for this game, or only what was on screen.
 */
export type ScreenshotRow = {
  name: string;
  category: string | null;
  confidence: number;
  rawValue: string;
  settingId: string | null;
  source: "preset" | "menu" | "screen";
  /** Preset/menu: the full definition. Screen: `{ type }` from the model's guess or "text". */
  def: SettingDefinition;
  /** Preset only. */
  current: SettingValue | null;
  /** Coerced and valid for `def`; null when the text couldn't be read as that type. */
  value: SettingValue | null;
};

/** What the catalog knows about a game beyond the user's preset. */
export type KnownSettings = { menu: CatalogMenuSetting[]; aliases: Map<string, string[]> };
export const NOTHING_KNOWN: KnownSettings = { menu: [], aliases: new Map() };

type Setting = CategoryWithSettings["settings"][number];
type Tracked = { ref: string; setting: Setting; category: string; names: string[] };
type Menu = { ref: string; entry: CatalogMenuSetting; names: string[] };

export const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

const definitionOf = (s: Setting | CatalogMenuSetting): SettingDefinition => ({
  type: s.type,
  min: s.min,
  max: s.max,
  step: "step" in s ? s.step : null,
  options: s.options,
  unit: s.unit,
});

/** Menu entries and every alias the catalog records, keyed by normalised setting name. */
export function knownSettings(game: CatalogGame | null): KnownSettings {
  if (!game) return NOTHING_KNOWN;
  const aliases = new Map<string, string[]>();
  const all = [
    ...game.presets.flatMap((p) => p.categories.flatMap((c) => c.settings)),
    ...game.menu,
  ];
  for (const s of all) if (s.aliases?.length) aliases.set(normalise(s.name), s.aliases);
  return { menu: game.menu, aliases };
}

/**
 * Gives every preset setting a `t…` ref and every menu entry the preset lacks an `m…` ref.
 * Deterministic in its inputs, so the hints and the matching agree on what a ref means.
 */
function indexSettings(categories: CategoryWithSettings[], known: KnownSettings) {
  const tracked: Tracked[] = [];
  for (const c of categories)
    for (const s of c.settings)
      tracked.push({
        ref: `t${tracked.length + 1}`,
        setting: s,
        category: c.name,
        names: [s.name, ...(known.aliases.get(normalise(s.name)) ?? [])],
      });
  const taken = new Set(tracked.flatMap((t) => t.names.map(normalise)));
  const menu: Menu[] = [];
  for (const entry of known.menu) {
    const names = [entry.name, ...(entry.aliases ?? [])];
    if (names.some((n) => taken.has(normalise(n)))) continue;
    menu.push({ ref: `m${menu.length + 1}`, entry, names });
  }
  return { tracked, menu };
}

const hint = (
  ref: string,
  category: string,
  s: Setting | CatalogMenuSetting,
  names: string[],
): HintSetting => ({
  ref,
  category,
  name: s.name,
  type: s.type,
  options: s.options?.length ? s.options.map((o) => o.label) : undefined,
  unit: s.unit ?? null,
  aliases: names.length > 1 ? names.slice(1) : undefined,
});

export function buildHints(
  game: { name: string },
  categories: CategoryWithSettings[],
  known: KnownSettings = NOTHING_KNOWN,
): ScreenshotHints {
  const { tracked, menu } = indexSettings(categories, known);
  return {
    gameName: game.name,
    tracked: tracked.map((t) => hint(t.ref, t.category, t.setting, t.names)),
    menu: menu.map((m) => hint(m.ref, m.entry.category, m.entry, m.names)),
  };
}

/**
 * Resolves what the model read. A row's ref wins; without one (or when two rows claim the same
 * ref) the on-screen label is matched against the known names and aliases, with the category
 * breaking ties. Anything still unknown becomes a new setting from the screen alone.
 */
export function matchProposals(
  proposals: ProposedSetting[],
  categories: CategoryWithSettings[],
  known: KnownSettings = NOTHING_KNOWN,
): ScreenshotRow[] {
  const { tracked, menu } = indexSettings(categories, known);
  const byRef = new Map<string, Tracked | Menu>([...tracked, ...menu].map((x) => [x.ref, x]));
  const byName = new Map<string, (Tracked | Menu)[]>();
  for (const x of [...tracked, ...menu])
    for (const n of x.names) {
      const key = normalise(n);
      const list = byName.get(key) ?? [];
      if (!list.includes(x)) byName.set(key, [...list, x]);
    }

  // One screen row per ref: the row whose label is one of the ref's names, else the surest.
  const claims = new Map<string, ProposedSetting>();
  const rank = (p: ProposedSetting, x: Tracked | Menu) =>
    (x.names.some((n) => normalise(n) === normalise(p.name)) ? 2 : 0) + clamp(p.confidence);
  for (const p of proposals) {
    const x = p.ref ? byRef.get(p.ref) : undefined;
    if (!x) continue;
    const prev = claims.get(x.ref);
    if (!prev || rank(p, x) > rank(prev, x)) claims.set(x.ref, p);
  }

  const order = new Map([...tracked, ...menu].map((x, i) => [x.ref, i]));
  const resolved: { order: number; row: ScreenshotRow }[] = [];
  const fresh: ScreenshotRow[] = [];
  for (const p of proposals) {
    const confidence = clamp(p.confidence);
    const claimed = p.ref ? byRef.get(p.ref) : undefined;
    let x = claimed && claims.get(claimed.ref) === p ? claimed : undefined;
    if (!x) {
      // A setting another row already claimed by ref is not up for grabs by name.
      const candidates = (byName.get(normalise(p.name)) ?? []).filter((c) => !claims.has(c.ref));
      const wanted = p.category ? normalise(p.category) : null;
      x =
        candidates.find(
          (c) => wanted && normalise("setting" in c ? c.category : c.entry.category) === wanted,
        ) ?? candidates[0];
    }
    if (!x) {
      const def: SettingDefinition = { type: p.type ?? "text" };
      fresh.push({
        name: p.name.trim(),
        category: p.category,
        confidence,
        rawValue: p.rawValue,
        settingId: null,
        source: "screen",
        def,
        current: null,
        value: coerceValue(def, p.rawValue),
      });
      continue;
    }
    if ("setting" in x) {
      const def = definitionOf(x.setting);
      resolved.push({
        order: order.get(x.ref)!,
        row: {
          name: x.setting.name,
          category: x.category,
          confidence,
          rawValue: p.rawValue,
          settingId: x.setting.id,
          source: "preset",
          def,
          current: (x.setting.value as SettingValue | null) ?? null,
          value: coerceValue(def, p.rawValue),
        },
      });
    } else {
      const def = definitionOf(x.entry);
      resolved.push({
        order: order.get(x.ref)!,
        row: {
          name: x.entry.name,
          category: x.entry.category,
          confidence,
          rawValue: p.rawValue,
          settingId: null,
          source: "menu",
          def,
          current: null,
          value: coerceValue(def, p.rawValue),
        },
      });
    }
  }
  resolved.sort((a, b) => a.order - b.order);
  return mergeRows([[...resolved.map((k) => k.row), ...fresh]]);
}

/** Rows from one or more analyses: the same setting keeps its most confident reading; preset rows first. */
export function mergeRows(batches: ScreenshotRow[][]): ScreenshotRow[] {
  const seen = new Map<string, ScreenshotRow>();
  for (const row of batches.flat()) {
    const key = row.settingId ?? `new:${normalise(row.name)}`;
    const prev = seen.get(key);
    if (!prev || row.confidence > prev.confidence) seen.set(key, row);
  }
  const rows = [...seen.values()];
  return [...rows.filter((r) => r.settingId), ...rows.filter((r) => !r.settingId)];
}
