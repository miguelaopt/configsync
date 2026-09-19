"use client";
import * as React from "react";
import { compareImportAction } from "@/lib/actions/import";
import type { ImportPreview, ImportStrategy } from "@/lib/data/import";
import type { PresetDoc } from "@/lib/import-export/schema";
import type { DiffResult } from "@/lib/compare/diff";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toastError } from "@/components/ui/toaster";
import { plural, timeAgo } from "@/lib/utils/format";

export function ConflictReview({
  conflict,
  incoming,
  exportedAt,
  choice,
  onChoice,
  disabled,
}: {
  conflict: NonNullable<ImportPreview["games"][number]["presets"][number]["conflict"]>;
  incoming: PresetDoc;
  exportedAt?: string;
  choice: ImportStrategy;
  onChoice: (choice: ImportStrategy) => void;
  disabled: boolean;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [diff, setDiff] = React.useState<DiffResult | null>(null);
  const [pending, startTransition] = React.useTransition();
  const compare = () =>
    startTransition(async () => {
      const result = await compareImportAction({ presetId: conflict.id, incoming });
      if (!result.ok) return toastError(result.error);
      setDiff(result.data);
      setOpen(true);
    });
  const exported =
    exportedAt && Number.isFinite(Date.parse(exportedAt)) ? timeAgo(exportedAt) : null;
  return (
    <div className="mt-3 w-full rounded-lg border border-line bg-ground p-3 sm:p-4">
      <p className="mb-3 font-medium text-note">Preset already exists</p>
      <dl className="grid grid-cols-2 gap-4 text-[13px]">
        <div>
          <dt className="mb-1 text-ink-3">Current</dt>
          <dd className="text-ink">{plural(conflict.settingCount, "setting")}</dd>
          <dd className="mt-1 text-ink-3">Edited {timeAgo(conflict.updatedAt)}</dd>
        </div>
        <div>
          <dt className="mb-1 text-ink-3">Import</dt>
          <dd className="text-ink">
            {plural(
              incoming.categories.reduce((n, c) => n + c.settings.length, 0),
              "setting",
            )}
          </dd>
          <dd className="mt-1 text-ink-3">
            {exported ? `Exported ${exported}` : "Export date unavailable"}
          </dd>
        </div>
      </dl>
      <fieldset disabled={disabled} className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <legend className="sr-only">Resolve {incoming.name}</legend>
        {(
          [
            ["skip", "Keep current"],
            ["keep-both", "Import as copy"],
            ["replace", "Replace current"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={id}
              value={value}
              checked={choice === value}
              onChange={() => onChoice(value)}
              className="size-4 accent-[var(--accent)]"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={compare}
        loading={pending}
        disabled={disabled}
      >
        Compare differences
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`${incoming.name} — compare differences`}
          description="Current values in your vault compared with the incoming preset. Nothing has been saved."
          size="lg"
        >
          {diff ? (
            <>
              <p className="mb-4 text-[13px] text-ink-2">
                {diff.counts.changed} changed · {diff.counts.added} added · {diff.counts.removed}{" "}
                removed · {diff.counts.same} unchanged
              </p>
              {diff.counts.changed + diff.counts.added + diff.counts.removed === 0 ? (
                <p className="text-[13px] text-ink-2">These presets have identical settings.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="text-ink-3">
                        <th className="p-2">Setting</th>
                        <th className="p-2">Current</th>
                        <th className="p-2">Import</th>
                      </tr>
                    </thead>
                    {diff.categories.map((category) => {
                      const entries = category.entries.filter((entry) => entry.status !== "same");
                      if (!entries.length) return null;
                      return (
                        <tbody key={category.name}>
                          <tr>
                            <th
                              colSpan={3}
                              className="border-b border-hairline p-2 pt-4 font-medium"
                            >
                              {category.name}
                            </th>
                          </tr>
                          {entries.map((entry, index) => (
                            <tr key={index} className="border-b border-hairline">
                              <th scope="row" className="p-2 font-normal">
                                {entry.name}
                                <span className="mt-1 block text-[11px] text-ink-3">
                                  {entry.status}
                                </span>
                              </th>
                              <td className="max-w-48 p-2 break-words text-ink-2">
                                {entry.aDisplay || "—"}
                              </td>
                              <td className="max-w-48 p-2 break-words">{entry.bDisplay || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      );
                    })}
                  </table>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
