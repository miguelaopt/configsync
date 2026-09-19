"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { GAME_SORTS, type GameSort } from "@/lib/types";

/** Search box (debounced, URL-backed) + active/archived switch + sort. */
export function LibraryToolbar({
  query,
  archived,
  sort,
}: {
  query: string;
  archived: boolean;
  sort: GameSort;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(query);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      router.replace(`/games${href({ q: value.trim(), archived, sort })}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:w-80">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Filter by name, platform or tag"
          aria-label="Filter games"
          className="pr-8 pl-8"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear filter"
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xs text-ink-3 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div
        className="inline-flex rounded-sm border border-line bg-ground p-0.5"
        role="tablist"
        aria-label="Show"
      >
        {[
          {
            label: "Active",
            href: `/games${href({ q: query, archived: false, sort })}`,
            active: !archived,
          },
          {
            label: "Archived",
            href: `/games${href({ q: query, archived: true, sort })}`,
            active: archived,
          },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            role="tab"
            aria-selected={t.active}
            className={cn(
              "flex h-7 items-center rounded-xs px-3 text-[13px] transition-colors",
              t.active
                ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <label className="ml-auto flex items-center gap-2 text-[13px] whitespace-nowrap text-ink-3">
        Sort by
        <Select
          value={sort}
          onValueChange={(v) =>
            router.replace(`/games${href({ q: query, archived, sort: v as GameSort })}`)
          }
        >
          <SelectTrigger aria-label="Sort games" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GAME_SORTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}

/** One place that builds the library URL, so every control keeps the others' state. */
function href({ q, archived, sort }: { q: string; archived: boolean; sort: GameSort }) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (archived) params.set("view", "archived");
  if (sort !== "updated") params.set("sort", sort);
  return params.size ? `?${params}` : "";
}
