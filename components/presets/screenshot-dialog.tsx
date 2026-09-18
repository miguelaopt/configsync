"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { applyScreenshotAction } from "@/lib/actions/ai";
import { mergeRows, normalise, type ScreenshotRow } from "@/lib/ai/screenshot";
import {
  formatValue,
  SETTING_TYPE_IDS,
  SETTING_TYPES,
  type SettingTypeId,
} from "@/lib/settings/types";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingControl } from "@/components/settings/setting-control";
import { toastError } from "@/components/ui/toaster";
import { plural } from "@/lib/utils/format";

export type ScreenshotMenuProps = {
  enabled: boolean;
  pro: boolean;
  categories: { id: string; name: string }[];
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetId: string;
  pro: boolean;
  categories: { id: string; name: string }[];
};

/** A row plus its review state. `key` is stable across merges (settingId or normalised name). */
type Row = ScreenshotRow & { key: string; checked: boolean; categoryId: string | null };
type Phase = "pick" | "analysing" | "review";

const MAX_FILES = 5;
const MAX_EDGE = 1568;
const PRIVACY =
  "Screenshots are sent to Anthropic to read the settings. They are analysed once and not stored.";

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Upload screenshots of the game's settings menu, review what was read, apply what you tick. */
export function ScreenshotDialog({ open, onOpenChange, presetId, pro, categories }: Props) {
  const router = useRouter();
  const [files, setFiles] = React.useState<File[]>([]);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [phase, setPhase] = React.useState<Phase>("pick");
  const [pending, startTransition] = React.useTransition();

  const reset = () => {
    setFiles([]);
    setRows([]);
    setPhase("pick");
  };
  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const toRow = (r: ScreenshotRow): Row => {
    if ("key" in r) return r as Row; // survived a merge: keep the user's edits
    const guess = r.category
      ? categories.find((c) => normalise(c.name) === normalise(r.category!))
      : undefined;
    return {
      ...r,
      key: r.settingId ?? `new:${normalise(r.name)}`,
      checked:
        r.settingId != null && r.value != null && r.confidence >= 0.5 && !same(r.value, r.current),
      categoryId: guess?.id ?? categories[0]?.id ?? null,
    };
  };

  const analyse = async () => {
    setPhase("analysing");
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const blob = await downscale(file);
          const res = await fetch(`/api/ai/screenshot?preset=${presetId}`, {
            method: "POST",
            body: blob,
            headers: { "Content-Type": blob.type || file.type },
          });
          const json = (await res.json()) as { rows?: ScreenshotRow[]; error?: string };
          if (!res.ok || !json.rows) {
            toastError(json.error ?? `Couldn't analyse ${file.name}.`);
            return null;
          }
          return json.rows;
        } catch {
          toast.error(`Couldn't analyse ${file.name}.`);
          return null;
        }
      }),
    );
    const ok = results.filter((r): r is ScreenshotRow[] => r != null);
    const merged = ok.length ? mergeRows([rows, ...ok]) : rows;
    if (ok.length === 0 || merged.length === 0) {
      if (ok.length > 0) toast.error("No settings found in those screenshots.");
      setPhase(rows.length ? "review" : "pick");
      return;
    }
    setRows(merged.map(toRow));
    setFiles([]);
    setPhase("review");
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const matched = rows.filter((r) => r.settingId);
  const fresh = rows.filter((r) => !r.settingId);
  const selected = rows.filter(
    (r) => r.checked && r.value != null && (r.settingId || r.categoryId),
  );

  const apply = () =>
    startTransition(async () => {
      const r = await applyScreenshotAction({
        presetId,
        updates: selected
          .filter((r) => r.settingId)
          .map((r) => ({ id: r.settingId!, value: r.value })),
        creates: selected
          .filter((r) => !r.settingId)
          .map((r) => ({
            categoryId: r.categoryId!,
            name: r.name,
            type: r.def.type,
            value: r.value,
          })),
      });
      if (!r.ok) return toastError(r.error);
      toast.success(
        `Applied ${plural(r.data.updated + r.data.created, "setting")} from your screenshots`,
      );
      router.refresh();
      close(false);
    });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title="Import from screenshot"
        description={
          phase === "review"
            ? "Tick what to apply. Nothing is saved until you press Apply."
            : PRIVACY
        }
        size={phase === "review" ? "lg" : "md"}
      >
        {!pro ? (
          <div className="flex flex-col gap-4 text-[13px] text-ink-2">
            <p>
              Reading settings from screenshots is a Pro feature. Pro also unlocks unlimited games,
              full history and auto-switch.
            </p>
            <Button asChild variant="primary" className="self-start">
              <Link href="/pricing">See Pro</Link>
            </Button>
          </div>
        ) : phase === "analysing" ? (
          <div className="flex items-center gap-2 py-6 text-[13px] text-ink-2" role="status">
            <Loader2 className="size-4 animate-spin" /> Reading {plural(files.length, "screenshot")}
            …
          </div>
        ) : phase === "pick" ? (
          <div className="flex flex-col gap-4">
            <Input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                if (list.length > MAX_FILES)
                  toast.error(`Up to ${MAX_FILES} screenshots at a time.`);
                setFiles(list.slice(0, MAX_FILES));
              }}
            />
            {files.length ? (
              <ul className="flex flex-wrap gap-2">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`}>
                    <Thumb file={f} />
                  </li>
                ))}
              </ul>
            ) : null}
            <DialogFooter>
              {rows.length ? (
                <Button variant="secondary" onClick={() => setPhase("review")}>
                  Back to review
                </Button>
              ) : null}
              <Button variant="primary" onClick={analyse} disabled={files.length === 0}>
                Analyse
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {matched.length ? (
              <section>
                <h3 className="mb-1 text-xs font-medium tracking-wide text-ink-3 uppercase">
                  In this preset
                </h3>
                <ul>
                  {matched.map((r) => (
                    <li
                      key={r.key}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-hairline py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
                    >
                      <Checkbox
                        checked={r.checked}
                        disabled={r.value == null}
                        onCheckedChange={(c) => update(r.key, { checked: c === true })}
                        aria-label={`Apply ${r.name}`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[13px]">
                          <span className="truncate font-medium">{r.name}</span>
                          {r.confidence < 0.5 ? <Badge variant="note">Check</Badge> : null}
                        </div>
                        <div className="text-xs text-ink-3">
                          {r.category ? `${r.category} · ` : ""}Now: {formatValue(r.def, r.current)}
                        </div>
                        {r.value == null ? (
                          <div className="text-xs text-note">
                            Read as “{r.rawValue}” — pick the value by hand.
                          </div>
                        ) : null}
                      </div>
                      <div className="col-start-2 sm:col-start-3">
                        <SettingControl
                          id={`ss-${r.key}`}
                          label={r.name}
                          def={r.def}
                          value={r.value}
                          layout="row"
                          onChange={(v) => update(r.key, { value: v, checked: v != null })}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {fresh.length ? (
              <section>
                <h3 className="mb-1 text-xs font-medium tracking-wide text-ink-3 uppercase">
                  Not in this preset
                </h3>
                {categories.length === 0 ? (
                  <p className="text-[13px] text-ink-2">
                    Add a category to this preset first to create these.
                  </p>
                ) : null}
                <ul>
                  {fresh.map((r) => (
                    <li
                      key={r.key}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-hairline py-2.5"
                    >
                      <Checkbox
                        checked={r.checked}
                        disabled={categories.length === 0 || r.value == null}
                        onCheckedChange={(c) => update(r.key, { checked: c === true })}
                        aria-label={`Create ${r.name}`}
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          value={r.name}
                          maxLength={120}
                          aria-label="Setting name"
                          onChange={(e) => update(r.key, { name: e.target.value })}
                        />
                        <Select
                          value={r.def.type}
                          onValueChange={(t) =>
                            update(r.key, {
                              def: { type: t as SettingTypeId },
                              value: null,
                              checked: false,
                            })
                          }
                        >
                          <SelectTrigger aria-label="Type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SETTING_TYPE_IDS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {SETTING_TYPES[t].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={r.categoryId ?? undefined}
                          onValueChange={(c) => update(r.key, { categoryId: c })}
                          disabled={categories.length === 0}
                        >
                          <SelectTrigger aria-label="Category">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="sm:col-span-3">
                          <SettingControl
                            id={`ss-${r.key}`}
                            label={r.name}
                            def={r.def}
                            value={r.value}
                            layout="row"
                            onChange={(v) =>
                              update(r.key, {
                                value: v,
                                checked: v != null && categories.length > 0,
                              })
                            }
                          />
                          {r.value == null ? (
                            <div className="mt-1 text-xs text-note">Read as “{r.rawValue}”.</div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <DialogFooter>
              <Button variant="secondary" onClick={() => setPhase("pick")}>
                Add more screenshots
              </Button>
              <Button
                variant="primary"
                onClick={apply}
                loading={pending}
                disabled={selected.length === 0}
              >
                Apply {plural(selected.length, "change")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Thumb({ file }: { file: File }) {
  const url = React.useMemo(() => URL.createObjectURL(file), [file]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local object URL
    <img src={url} alt={file.name} className="h-16 rounded-xs border border-line object-cover" />
  );
}

/** ≤ MAX_EDGE on the long side, re-encoded as WebP; falls back to the original when smaller or on failure. */
async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
