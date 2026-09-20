"use client";
import { z } from "zod";
import { History } from "lucide-react";
import { Panel } from "@/components/dashboard/panels";
import { createRecentStore } from "@/lib/recent-store";
import { plural, timeAgo } from "@/lib/utils/format";

const itemSchema = z.object({
  name: z.string(),
  presets: z.number(),
  importedAt: z.string().datetime(),
});
type RecentImport = z.infer<typeof itemSchema>;
const store = createRecentStore("imports", itemSchema);

/** Successful imports only; metadata stays in this browser and is scoped to the signed-in account. */
export function recordImport(userId: string, item: Omit<RecentImport, "importedAt">) {
  if (item.presets === 0) return;
  store.add(userId, { ...item, importedAt: new Date().toISOString() });
}

export function RecentImports({ userId }: { userId: string }) {
  const items = store.useItems(userId);
  return (
    <Panel
      id="recent-imports"
      icon={<History />}
      title="Recent imports"
      subtitle="Kept on this browser only — not a server log."
      className="mt-5"
    >
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
    </Panel>
  );
}
