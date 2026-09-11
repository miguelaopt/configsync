"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  Download,
  Gamepad2,
  LayoutDashboard,
  Layers,
  Search,
  Settings,
  SlidersHorizontal,
  Upload,
  Plus,
} from "lucide-react";
import { searchAction } from "@/lib/actions/search";
import type { SearchHit } from "@/lib/data/search";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";

const KIND_ICON = {
  game: Gamepad2,
  preset: Layers,
  category: SlidersHorizontal,
  setting: SlidersHorizontal,
} as const;
const KIND_LABEL = {
  game: "Games",
  preset: "Presets",
  category: "Categories",
  setting: "Settings",
} as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery("");
        setHits([]);
        setLoading(false);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const changeQuery = (value: string) => {
    setQuery(value);
    const short = value.trim().length < 2;
    if (short) setHits([]);
    setLoading(!short);
  };

  // Debounced server search; state updates happen inside the timer callback.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      const result = await searchAction(q);
      setHits(result.ok ? result.data : []);
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const grouped = React.useMemo(() => {
    const map = new Map<SearchHit["kind"], SearchHit[]>();
    for (const h of hits) map.set(h.kind, [...(map.get(h.kind) ?? []), h]);
    return Array.from(map.entries());
  }, [hits]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-x-2 top-[8dvh] z-50 mx-auto max-w-xl overflow-hidden rounded-md border border-line bg-surface shadow-dialog outline-none data-[state=open]:animate-fade-in sm:inset-x-4"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search and commands</DialogPrimitive.Title>
          <Command shouldFilter={false} label="Search">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={changeQuery}
                placeholder="Search games, presets, categories, settings…"
                className="h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
              />
              {loading ? <Spinner /> : <Kbd className="hidden sm:inline-flex">Esc</Kbd>}
            </div>
            <Command.List className="max-h-[60dvh] scrollbar-thin overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-ink-3">
                {query.trim().length < 2
                  ? "Type to search across your whole library."
                  : loading
                    ? "Searching…"
                    : `Nothing matches "${query}".`}
              </Command.Empty>

              {grouped.map(([kind, items]) => (
                <Command.Group
                  key={kind}
                  heading={KIND_LABEL[kind]}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-3"
                >
                  {items.map((hit) => {
                    const Icon = KIND_ICON[hit.kind];
                    return (
                      <Command.Item
                        key={`${hit.kind}-${hit.id}`}
                        value={`${hit.kind}-${hit.id}`}
                        onSelect={() => go(hit.href)}
                        className="flex h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm data-[selected=true]:bg-raised sm:h-10"
                      >
                        <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">{hit.title}</span>
                          <span className="block truncate text-xs text-ink-3">{hit.subtitle}</span>
                        </span>
                        {hit.kind === "setting" ? (
                          <span className="tnum max-w-[35%] truncate text-[13px] text-ink-2">
                            {hit.value}
                          </span>
                        ) : null}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}

              {query.trim().length < 2 ? (
                <Command.Group
                  heading="Go to"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-3"
                >
                  {[
                    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                    { label: "Games", href: "/games", icon: Gamepad2 },
                    { label: "Add a game", href: "/games?new=1", icon: Plus },
                    { label: "Import", href: "/import", icon: Upload },
                    { label: "Export", href: "/export", icon: Download },
                    { label: "Settings", href: "/settings", icon: Settings },
                  ].map((c) => (
                    <Command.Item
                      key={c.href}
                      value={c.label}
                      onSelect={() => go(c.href)}
                      className="flex h-10 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm text-ink data-[selected=true]:bg-raised"
                    >
                      <c.icon className="size-4 text-ink-3" aria-hidden />
                      {c.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : hits.length > 0 ? (
                <Command.Item
                  value="see-all"
                  onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
                  className="mt-1 flex h-10 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm text-accent data-[selected=true]:bg-raised"
                >
                  <Search className="size-4" aria-hidden />
                  See all results for “{query.trim()}”
                </Command.Item>
              ) : null}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
