/** Client-safe filter for the preset editor: a search box and a single-category picker. */

type FilterSetting = { id: string; name: string; description: string | null; notes: string | null };
type FilterCategory<S extends FilterSetting> = { id: string; name: string; settings: S[] };

/**
 * Which settings to show, per category, or null when nothing is filtered. Every word of the query
 * must appear in the setting's name, its category, description, notes or config keys.
 */
export function filterSettings<S extends FilterSetting>(
  categories: FilterCategory<S>[],
  query: string,
  categoryId: string | null,
  keysOf: (s: S) => string[] = () => [],
): Map<string, S[]> | null {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0 && !categoryId) return null;
  const shown = new Map<string, S[]>();
  for (const c of categories) {
    if (categoryId && c.id !== categoryId) continue;
    const settings = c.settings.filter((s) => {
      const text = [s.name, c.name, s.description, s.notes, ...keysOf(s)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return words.every((w) => text.includes(w));
    });
    if (settings.length > 0 || (words.length === 0 && categoryId)) shown.set(c.id, settings);
  }
  return shown;
}
