"use client";
import * as React from "react";
import { MonitorSmartphone, Search } from "lucide-react";
import { searchGamesAction } from "@/lib/actions/search-games";
import { Input } from "@/components/ui/input";

export type Suggestion = {
  name: string;
  coverUrl?: string | null;
  catalogId: string | null;
  device?: string;
};
type Results = Extract<Awaited<ReturnType<typeof searchGamesAction>>, { ok: true }>["data"];

/** Name input with a listbox of installed-on-device and Steam store matches. Plain typing still works. */
export function GameNameSuggest({
  id,
  value,
  onChange,
  onPick,
  ...inputProps
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
} & Pick<React.ComponentProps<"input">, "autoFocus" | "aria-invalid">) {
  const [results, setResults] = React.useState<Results | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (value.trim().length < 2) return;
    const t = setTimeout(() => {
      void searchGamesAction(value).then((r) => {
        if (r.ok) setResults(r.data);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  const rows: Suggestion[] =
    value.trim().length < 2
      ? []
      : [
          ...(results?.installed.map((g) => ({
            name: g.name,
            catalogId: g.catalogId,
            device: g.device,
          })) ?? []),
          ...(results?.steam.map((s) => ({
            name: s.name,
            coverUrl: s.coverUrl,
            catalogId: s.catalogId,
          })) ?? []),
        ];
  const listId = `${id}-suggestions`;
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        role="combobox"
        aria-expanded={open && rows.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="e.g. Skyline Drift"
        required
        maxLength={120}
        {...inputProps}
      />
      {open && rows.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-overlay p-1 shadow-menu"
        >
          {rows.map((s, i) => (
            <li key={`${s.device ?? "steam"}-${s.name}-${i}`} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                }}
                className="menu-row flex w-full cursor-pointer items-center gap-2 rounded-xs px-2 py-1.5 text-left text-[13px]"
              >
                {s.device ? (
                  <MonitorSmartphone className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                ) : (
                  <Search className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                )}
                <span className="truncate text-ink">{s.name}</span>
                <span className="ml-auto shrink-0 text-xs text-ink-3">
                  {s.device ? `Installed on ${s.device}` : "Steam"}
                  {s.catalogId ? " · catalog" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
