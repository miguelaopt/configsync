"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Copy, Equal, Minus, Plus, TriangleAlert } from "lucide-react";
import type { DiffResult, DiffStatus } from "@/lib/compare/diff";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { copyWithToast } from "@/lib/copy/use-copy";
import { cn } from "@/lib/utils/cn";

type PresetOption = { id: string; name: string };

const STATUS: Record<DiffStatus, { label: string; icon: React.ElementType; className: string }> = {
  same: { label: "Same", icon: Equal, className: "text-ink-3" },
  changed: { label: "Changed", icon: TriangleAlert, className: "text-accent" },
  added: { label: "Only in B", icon: Plus, className: "text-good" },
  removed: { label: "Only in A", icon: Minus, className: "text-bad" },
};

export function CompareView({
  gameSlug,
  presets,
  aId,
  bId,
  aName,
  bName,
  diff,
}: {
  gameSlug: string;
  presets: PresetOption[];
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  diff: DiffResult;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"all" | "differences">("differences");
  const go = (a: string, b: string) => router.push(`/games/${gameSlug}/compare?a=${a}&b=${b}`);
  const total = Object.values(diff.counts).reduce((n, c) => n + c, 0);
  const differences = total - diff.counts.same;

  const copyDiff = () => {
    const lines: string[] = [`${aName} vs ${bName}`, ""];
    for (const c of diff.categories) {
      const entries = c.entries.filter((e) => e.status !== "same");
      if (entries.length === 0) continue;
      lines.push(`[${c.name}]`);
      for (const e of entries) {
        if (e.status === "changed") lines.push(`${e.name}: ${e.aDisplay} → ${e.bDisplay}`);
        else if (e.status === "added") lines.push(`${e.name}: (missing) → ${e.bDisplay}`);
        else lines.push(`${e.name}: ${e.aDisplay} → (missing)`);
      }
      lines.push("");
    }
    return copyWithToast(lines.join("\n").trim(), "Copied differences");
  };

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <PresetPicker label="Preset A" value={aId} presets={presets} onChange={(v) => go(v, bId)} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Swap presets"
          onClick={() => go(bId, aId)}
          className="justify-self-center"
        >
          <ArrowLeftRight />
        </Button>
        <PresetPicker label="Preset B" value={bId} presets={presets} onChange={(v) => go(aId, v)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {(Object.keys(STATUS) as DiffStatus[]).map((s) => {
            const Icon = STATUS[s].icon;
            return (
              <li key={s} className={cn("inline-flex items-center gap-1.5", STATUS[s].className)}>
                <Icon className="size-3.5" aria-hidden />
                <span className="tnum">
                  {diff.counts[s]} {STATUS[s].label.toLowerCase()}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2">
          <Segmented
            aria-label="Show"
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
            options={[
              { label: "Differences", value: "differences" },
              { label: "All", value: "all" },
            ]}
          />
          <Button variant="secondary" size="sm" onClick={copyDiff} disabled={differences === 0}>
            <Copy /> Copy differences
          </Button>
        </div>
      </div>

      {total === 0 ? (
        <p className="py-12 text-center text-[13px] text-ink-3">Neither preset has settings yet.</p>
      ) : differences === 0 && filter === "differences" ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Check className="size-6 text-good" aria-hidden />
          <p className="text-[13px] text-ink-2">These presets are identical.</p>
          <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
            Show all settings
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px] sm:min-w-[560px]">
            <thead className="sr-only sm:not-sr-only">
              <tr className="text-left text-xs text-ink-3">
                <th scope="col" className="w-28 py-2 pl-3 font-medium">
                  Status
                </th>
                <th scope="col" className="py-2 font-medium">
                  Setting
                </th>
                <th scope="col" className="py-2 font-medium">
                  A · {aName}
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  B · {bName}
                </th>
              </tr>
            </thead>
            {diff.categories.map((c) => {
              const entries =
                filter === "all" ? c.entries : c.entries.filter((e) => e.status !== "same");
              if (entries.length === 0) return null;
              return (
                <tbody key={c.name}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={4}
                      className="border-b border-line-strong pt-5 pb-1.5 pl-3 text-left text-[16px] font-semibold text-ink"
                    >
                      {c.name}
                    </th>
                  </tr>
                  {entries.map((e) => {
                    const Icon = STATUS[e.status].icon;
                    return (
                      <tr key={`${c.name}-${e.name}`} className="menu-row">
                        <td
                          className={cn(
                            "py-2.5 pr-2 pl-3 align-top whitespace-nowrap",
                            STATUS[e.status].className,
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="size-3.5" aria-hidden />
                            <span className="sr-only sm:not-sr-only">{STATUS[e.status].label}</span>
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 align-top text-ink">{e.name}</td>
                        <td
                          className={cn(
                            "tnum py-2.5 pr-3 align-top",
                            e.status === "changed"
                              ? "text-ink"
                              : e.status === "added"
                                ? "text-ink-3"
                                : "text-ink-2",
                            e.status === "changed" && "line-through decoration-ink-3/60",
                          )}
                        >
                          {e.aDisplay || <span className="text-ink-3">—</span>}
                        </td>
                        <td
                          className={cn(
                            "tnum py-2.5 pr-3 align-top font-medium",
                            e.status === "changed" || e.status === "added"
                              ? "text-ink"
                              : "text-ink-2",
                          )}
                        >
                          {e.bDisplay || <span className="text-ink-3">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}

function PresetPicker({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string;
  presets: PresetOption[];
  onChange: (v: string) => void;
}) {
  const id = `picker-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
