import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2, Layers, Search, SlidersHorizontal } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { searchAll, type SearchHit } from "@/lib/data/search";
import { Page, PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/dashboard/panels";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchForm } from "@/components/app/search-form";
import type { SearchParams } from "@/lib/types";
import { plural } from "@/lib/utils/format";

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
        <div className="flex flex-col gap-5">
          {groups.map(({ kind, items }) => {
            const Icon = KIND[kind].icon;
            return (
              <Panel
                key={kind}
                icon={<Icon />}
                title={KIND[kind].label}
                subtitle={plural(items.length, "match", "matches")}
                bodyClassName="px-2 pb-2 sm:px-2 sm:pb-2"
              >
                <ul className="divide-y divide-hairline">
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
              </Panel>
            );
          })}
        </div>
      )}
    </Page>
  );
}
