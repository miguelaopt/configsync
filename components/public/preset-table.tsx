import type { CategoryDoc } from "@/lib/import-export/schema";
import { formatValue, type SettingValue } from "@/lib/settings/types";

/** Read-only view of a preset: one card per category, name · value rows. */
export function PresetTable({ categories }: { categories: CategoryDoc[] }) {
  if (categories.length === 0)
    return <p className="text-[13px] text-ink-3">This preset has no settings yet.</p>;
  return (
    <div className="flex flex-col gap-4">
      {categories.map((c) => (
        <section
          key={c.name}
          className="rounded-md border border-line bg-surface"
          aria-labelledby={`cat-${c.name}`}
        >
          <h2
            id={`cat-${c.name}`}
            className="border-b border-hairline px-4 py-2.5 font-display text-[15px]"
          >
            {c.name}
          </h2>
          <dl>
            {c.settings.map((s) => (
              <div
                key={s.name}
                className="flex items-baseline justify-between gap-4 border-b border-hairline px-4 py-2 last:border-b-0"
              >
                <dt className="text-[13px] text-ink-2">{s.name}</dt>
                <dd className="text-right font-mono text-[13px] text-ink">
                  {formatValue(s, s.value as SettingValue | null) || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
