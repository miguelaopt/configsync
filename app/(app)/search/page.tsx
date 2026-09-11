import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2, Layers, Search, SlidersHorizontal } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { searchAll, type SearchHit } from "@/lib/data/search";
import { Page, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchForm } from "@/components/app/search-form";
import type { SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Search" };

const KIND: Record<SearchHit["kind"], { label: string; icon: React.ElementType }> = {
  game: { label: "Games", icon: Gamepad2 },
  preset: { label: "Presets", icon: Layers },
  category: { label: "Categories", icon: SlidersHorizontal },
  setting: { label: "Settings", icon: SlidersHorizontal },
};

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const hits = q.length >= 2 ? await searchAll(user.id, q, 25) : [];
  const groups = (Object.keys(KIND) as SearchHit["kind"][])
    .map((kind) => ({ kind, items: hits.filter((h) => h.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <Page>
      <PageHeader
        title="Search"
        description="Games, presets, categories, setting names, values, notes and tags."
      >
        <SearchForm initial={q} />
      </PageHeader>
      {q.length < 2 ? (
        <p className="text-[13px] text-ink-3">Type at least two characters.</p>
      ) : hits.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={`Nothing matches “${q}”`}
          description="Try a shorter word, a value like “1440” or a tag."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ kind, items }) => {
            const Icon = KIND[kind].icon;
            return (
              <section key={kind} aria-labelledby={`group-${kind}`}>
                <h2 id={`group-${kind}`} className="mb-2 font-display text-[17px]">
                  {KIND[kind].label} <span className="tnum text-sm text-ink-3">{items.length}</span>
                </h2>
                <ul className="divide-y divide-hairline border-y border-hairline">
                  {items.map((hit) => (
                    <li key={hit.id}>
                      <Link
                        href={hit.href}
                        className="menu-row flex items-center gap-3 px-3 py-2.5 outline-offset-[-2px]"
                      >
                        <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] text-ink">{hit.title}</span>
                          <span className="block truncate text-xs text-ink-3">{hit.subtitle}</span>
                        </span>
                        {hit.kind === "setting" ? (
                          <span className="tnum max-w-[40%] truncate text-[13px] text-ink-2">
                            {hit.value}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}
