import { coerceValue } from "@/lib/settings/coerce";
import type { SettingDefinition, SettingValue } from "@/lib/settings/types";
import type { ProposedSetting, ScreenshotHints } from "@/lib/providers/screenshot";
import type { CategoryWithSettings } from "@/lib/data/presets";

// No runtime server imports here: the review dialog calls mergeRows in the browser.

/** One reviewable line: an update to an existing setting (settingId set) or a new setting. */
export type ScreenshotRow = {
  name: string;
  category: string | null;
  confidence: number;
  rawValue: string;
  settingId: string | null;
  /** Matched: the setting's own definition. New: `{ type }` from the model's guess or "text". */
  def: SettingDefinition;
  /** Matched only. */
  current: SettingValue | null;
  /** Coerced and valid for `def`; null when the text couldn't be read as that type. */
  value: SettingValue | null;
};

type Setting = CategoryWithSettings["settings"][number];

export const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

const definitionOf = (s: Setting): SettingDefinition => ({
  type: s.type,
  min: s.min,
  max: s.max,
  step: s.step,
  options: s.options,
  unit: s.unit,
});

export function buildHints(
  game: { name: string },
  categories: CategoryWithSettings[],
): ScreenshotHints {
  return {
    gameName: game.name,
    categories: categories.map((c) => ({
      name: c.name,
      settings: c.settings.map((s) => ({
        name: s.name,
        type: s.type,
        options: s.options?.length ? s.options.map((o) => o.label) : undefined,
        unit: s.unit ?? null,
      })),
    })),
  };
}

/** Matches what the model read to the preset's settings; unmatched names become "new" rows. */
export function matchProposals(
  proposals: ProposedSetting[],
  categories: CategoryWithSettings[],
): ScreenshotRow[] {
  type Candidate = { setting: Setting; category: string; order: number };
  const index = new Map<string, Candidate[]>();
  let order = 0;
  for (const c of categories)
    for (const s of c.settings) {
      const key = normalise(s.name);
      index.set(key, [...(index.get(key) ?? []), { setting: s, category: c.name, order: order++ }]);
    }

  const matched: { order: number; row: ScreenshotRow }[] = [];
  const fresh: ScreenshotRow[] = [];
  for (const p of proposals) {
    const confidence = clamp(p.confidence);
    const candidates = index.get(normalise(p.name));
    if (!candidates) {
      const def: SettingDefinition = { type: p.type ?? "text" };
      fresh.push({
        name: p.name.trim(),
        category: p.category,
        confidence,
        rawValue: p.rawValue,
        settingId: null,
        def,
        current: null,
        value: coerceValue(def, p.rawValue),
      });
      continue;
    }
    const wanted = p.category ? normalise(p.category) : null;
    const { setting, category, order } =
      candidates.find((c) => wanted && normalise(c.category) === wanted) ?? candidates[0]!;
    const def = definitionOf(setting);
    matched.push({
      order,
      row: {
        name: setting.name,
        category,
        confidence,
        rawValue: p.rawValue,
        settingId: setting.id,
        def,
        current: (setting.value as SettingValue | null) ?? null,
        value: coerceValue(def, p.rawValue),
      },
    });
  }
  matched.sort((a, b) => a.order - b.order);
  return mergeRows([[...matched.map((m) => m.row), ...fresh]]);
}

/** Rows from one or more images: the same setting keeps its most confident reading; matched rows first. */
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
