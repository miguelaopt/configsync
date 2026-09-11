/**
 * Preset comparison. Settings are matched by (category name, setting name),
 * case-insensitively, so presets that were built separately or imported still line up.
 */
import type { CategoryDoc, SettingDoc } from "@/lib/import-export/schema";
import { formatValue, valuesEqual, type SettingValue } from "@/lib/settings/types";

export type DiffStatus = "same" | "changed" | "added" | "removed";

export type DiffEntry = {
  category: string;
  name: string;
  status: DiffStatus;
  a: SettingDoc | null;
  b: SettingDoc | null;
  aDisplay: string;
  bDisplay: string;
};

export type DiffCategory = { name: string; entries: DiffEntry[] };

export type DiffResult = {
  categories: DiffCategory[];
  counts: Record<DiffStatus, number>;
};

const norm = (s: string) => s.trim().toLowerCase();

export function comparePresets(a: CategoryDoc[], b: CategoryDoc[]): DiffResult {
  const counts: Record<DiffStatus, number> = { same: 0, changed: 0, added: 0, removed: 0 };
  const categoryOrder: string[] = [];
  const byCategory = new Map<string, { name: string; a: SettingDoc[]; b: SettingDoc[] }>();

  const collect = (side: "a" | "b", cats: CategoryDoc[]) => {
    for (const c of cats) {
      const key = norm(c.name);
      let bucket = byCategory.get(key);
      if (!bucket) {
        bucket = { name: c.name, a: [], b: [] };
        byCategory.set(key, bucket);
        categoryOrder.push(key);
      }
      bucket[side].push(...c.settings);
    }
  };
  collect("a", a);
  collect("b", b);

  const categories: DiffCategory[] = [];
  for (const key of categoryOrder) {
    const bucket = byCategory.get(key)!;
    const entries: DiffEntry[] = [];
    const bByName = new Map(bucket.b.map((s) => [norm(s.name), s] as const));
    const seenB = new Set<string>();

    for (const sa of bucket.a) {
      const sb = bByName.get(norm(sa.name)) ?? null;
      if (sb) seenB.add(norm(sa.name));
      const status: DiffStatus = !sb
        ? "removed"
        : sa.type === sb.type && valuesEqual(sa.value as SettingValue, sb.value as SettingValue)
          ? "same"
          : "changed";
      counts[status]++;
      entries.push({
        category: bucket.name,
        name: sa.name,
        status,
        a: sa,
        b: sb,
        aDisplay: formatValue(sa, sa.value as SettingValue | null),
        bDisplay: sb ? formatValue(sb, sb.value as SettingValue | null) : "",
      });
    }
    for (const sb of bucket.b) {
      if (seenB.has(norm(sb.name))) continue;
      counts.added++;
      entries.push({
        category: bucket.name,
        name: sb.name,
        status: "added",
        a: null,
        b: sb,
        aDisplay: "",
        bDisplay: formatValue(sb, sb.value as SettingValue | null),
      });
    }
    categories.push({ name: bucket.name, entries });
  }

  return { categories, counts };
}
