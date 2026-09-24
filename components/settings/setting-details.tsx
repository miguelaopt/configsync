"use client";
import * as React from "react";
import { Copy, FileCode2, Pencil, RotateCcw } from "lucide-react";
import type { Setting } from "@/lib/db/schema";
import type { SettingFileInfo } from "@/lib/catalog";
import { formatValue, valuesEqual, type SettingValue } from "@/lib/settings/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Everything ConfigSync knows about one setting, and nothing it does not: the value against its
 * default, the range or choices, where the game keeps it on disk (catalog games), and the
 * description and notes the user wrote. No tips, no "related settings": that data does not exist.
 */
export function SettingDetails({
  open,
  onOpenChange,
  setting,
  value,
  category,
  file,
  catalogGame,
  onReset,
  onEdit,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setting: Setting;
  value: SettingValue | null;
  category: string;
  /** Where the game stores it; null for settings (or games) the catalog does not map to a file. */
  file: SettingFileInfo | null;
  catalogGame: boolean;
  onReset: (v: SettingValue) => void;
  onEdit: () => void;
  onCopy: () => void;
}) {
  const def = (setting.defaultValue as SettingValue | null) ?? null;
  const atDefault = def != null && valuesEqual(def, value);
  const range =
    setting.min != null || setting.max != null
      ? `${setting.min ?? "…"} to ${setting.max ?? "…"}${setting.unit ? ` ${setting.unit}` : ""}${
          setting.step ? `, in steps of ${setting.step}` : ""
        }`
      : null;
  const options = setting.options?.map((o) => o.label) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={setting.name} description={category} size="md">
        <dl className="grid gap-4 text-[14px]">
          <div className="grid grid-cols-2 gap-3">
            <Fact label="Value">
              <span className="tnum text-ink">{formatValue(setting, value)}</span>
            </Fact>
            <Fact label="Default">
              {def != null ? (
                <span className="tnum text-ink-2">{formatValue(setting, def)}</span>
              ) : (
                <span className="text-ink-3">None set</span>
              )}
            </Fact>
          </div>
          {def != null ? (
            <p className="-mt-2 text-[13px] text-ink-3">
              {atDefault ? "At its default." : "Changed from its default."}
            </p>
          ) : null}

          {range ? <Fact label="Range">{range}</Fact> : null}
          {options.length ? <Fact label="Choices">{options.join(", ")}</Fact> : null}

          <Fact label="In the game's files">
            {file ? (
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 font-mono text-[12.5px] text-ink">
                  <FileCode2 className="size-3.5 text-ink-3" aria-hidden />
                  {file.file}
                </span>
                <span className="font-mono text-[12.5px] text-accent-text">
                  {file.bind
                    ? `"${String(value ?? "")}"  "${file.keys[0]}"`
                    : file.keys.map((k) => `"${k}"`).join(", ")}
                </span>
                <span className="text-[13px] text-ink-3">
                  The companion reads it from this file and writes it back, with a backup first.
                </span>
              </span>
            ) : (
              <span className="text-[13px] text-ink-3">
                {catalogGame
                  ? "Not kept in the game's config files, so the companion leaves it alone. Set it in the game by hand."
                  : "Stored in ConfigSync only. The companion writes files for catalog games."}
              </span>
            )}
          </Fact>

          {setting.description ? <Fact label="Description">{setting.description}</Fact> : null}
          {setting.notes ? <Fact label="Your notes">{setting.notes}</Fact> : null}
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {def != null ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={atDefault}
              onClick={() => {
                onReset(def);
                onOpenChange(false);
              }}
            >
              <RotateCcw /> Reset to {formatValue(setting, def)}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onEdit();
            }}
          >
            <Pencil /> Edit setting
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Copy /> Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">{label}</dt>
      <dd className="m-0 text-ink-2">{children}</dd>
    </div>
  );
}
