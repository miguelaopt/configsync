"use client";
import * as React from "react";
import { z } from "zod";
import { plural, timeAgo } from "@/lib/utils/format";

const itemSchema = z.object({
  name: z.string(),
  presets: z.number(),
  importedAt: z.string().datetime(),
});
type RecentImport = z.infer<typeof itemSchema>;
const key = (userId: string) => `configsync:imports:${userId}`;
const event = "configsync:imports-changed";

function read(userId: string) {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}
function parse(raw: string | null): RecentImport[] {
  try {
    const result = z.array(itemSchema).safeParse(JSON.parse(raw ?? "[]"));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

/** Successful imports only; metadata stays in this browser and is scoped to the signed-in account. */
export function recordImport(userId: string, item: Omit<RecentImport, "importedAt">) {
  if (item.presets === 0) return;
  try {
    const recent = [
      { ...item, importedAt: new Date().toISOString() },
      ...parse(read(userId)),
    ].slice(0, 8);
    localStorage.setItem(key(userId), JSON.stringify(recent));
    window.dispatchEvent(new Event(event));
  } catch {
    /* Storage is optional; an import still succeeds when it is unavailable. */
  }
}

function subscribe(listener: () => void) {
  window.addEventListener(event, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(event, listener);
    window.removeEventListener("storage", listener);
  };
}

export function RecentImports({ userId }: { userId: string }) {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => read(userId),
    () => null,
  );
  const items = React.useMemo(() => parse(raw), [raw]);
  return (
    <section aria-label="Recent imports" className="mt-8 border-t border-hairline pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-medium text-ink">Recent imports</h2>
        <span className="text-[12px] text-ink-3">On this browser</span>
      </div>
      {items.length ? (
        <ul className="divide-y divide-hairline">
          {items.map((item, index) => (
            <li
              key={`${item.importedAt}-${index}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate text-ink">{item.name}</span>
              <span className="text-ink-2">{plural(item.presets, "preset")}</span>
              <time dateTime={item.importedAt} className="text-ink-3">
                Imported {timeAgo(item.importedAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-3">Your completed imports will appear here.</p>
      )}
    </section>
  );
}
