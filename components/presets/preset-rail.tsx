import Link from "next/link";
import { Layers, Star } from "lucide-react";
import type { listPresetsForGame } from "@/lib/data/games";
import { Badge } from "@/components/ui/badge";
import { plural, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type PresetRow = Awaited<ReturnType<typeof listPresetsForGame>>[number];

/** The game's other presets, so switching between them is one click from inside one. */
export function PresetRail({
  presets,
  gameSlug,
  currentSlug,
}: {
  presets: PresetRow[];
  gameSlug: string;
  currentSlug: string;
}) {
  const active = presets.filter((p) => !p.isArchived);
  return (
    <section className="panel flex flex-col" aria-labelledby="preset-rail">
      <header className="flex items-center justify-between gap-3 border-b border-line p-4">
        <h2 id="preset-rail" className="text-[15px] font-semibold text-ink">
          Presets
        </h2>
        <Link
          href={`/games/${gameSlug}`}
          className="rounded-sm text-[13px] font-medium text-accent-text hover:text-ink"
        >
          All
        </Link>
      </header>
      <ul className="flex flex-col p-2">
        {active.map((p) => {
          const current = p.slug === currentSlug;
          return (
            <li key={p.id}>
              <Link
                href={`/games/${gameSlug}/${p.slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  current ? "bg-accent-soft" : "hover:bg-raised",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    current ? "bg-accent/25 text-accent-text" : "bg-raised text-ink-3",
                  )}
                >
                  <Layers className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-[14px] font-medium",
                        current ? "text-ink" : "text-ink-2",
                      )}
                    >
                      {p.name}
                    </span>
                    {p.isDefault ? <Badge variant="accent">Default</Badge> : null}
                    {p.isFavorite ? (
                      <Star className="size-3 shrink-0 fill-accent text-accent" aria-hidden />
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {plural(p.settingCount, "setting")} · {timeAgo(p.updatedAt)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
