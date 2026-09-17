"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createGameFromCatalogAction } from "@/lib/actions/catalog";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { Spinner } from "@/components/ui/spinner";
import { plural } from "@/lib/utils/format";

/** One row per catalog game; clicking creates it with the real menu structure and opens it. */
export function CatalogPicker({
  entries,
  owned,
  onDone,
}: {
  entries: PublicCatalogEntry[];
  owned: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const pick = (id: string) => {
    setPendingId(id);
    void createGameFromCatalogAction(id).then((result) => {
      setPendingId(null);
      if (!result.ok) return toast.error(result.error);
      toast.success("Game added with its real settings menu");
      onDone();
      router.push(`/games/${result.data.slug}`);
    });
  };
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Games in the catalog">
      {entries.map((e) => {
        const isOwned = owned.includes(e.id);
        return (
          <li key={e.id}>
            <button
              type="button"
              disabled={isOwned || pendingId != null}
              onClick={() => pick(e.id)}
              className="menu-row flex w-full items-center gap-3 rounded-sm border border-line p-2 text-left hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50"
              style={{ "--accent": e.accentColor ?? undefined } as React.CSSProperties}
            >
              {e.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.coverUrl} alt="" className="h-10 w-20 rounded-xs object-cover" />
              ) : null}
              <span className="flex flex-col">
                <span className="text-[13px] font-medium text-ink">{e.name}</span>
                <span className="text-xs text-ink-3">
                  {isOwned
                    ? "Already in your library"
                    : `${plural(e.settingCount, "setting")} · real menu names`}
                </span>
              </span>
              {pendingId === e.id ? <Spinner className="ml-auto" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
