"use client";
import * as React from "react";
import { toast } from "sonner";
import { patchGameConfigAction } from "@/lib/actions/catalog";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetId: string;
  entry: PublicCatalogEntry;
};
type Result = { files: Record<string, string>; skipped: string[] };

/** Upload the game's current files, get them back patched with this preset's values. */
export function ConfigFilesDialog({ open, onOpenChange, presetId, entry }: Props) {
  const [files, setFiles] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<Result | null>(null);
  const [pending, startTransition] = React.useTransition();
  const fileName = (id: string) =>
    (Object.values(entry.files.find((f) => f.id === id)?.paths ?? {})[0] ?? id)
      .split(/[\\/]/)
      .pop()!;

  const run = () =>
    startTransition(async () => {
      const r = await patchGameConfigAction({ catalogId: entry.id, presetId, files });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setResult(r.data);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Game config files"
        description="Upload the files the game has now and get them back with this preset’s values. Replace the originals while the game is closed — or let the companion do it: gsv apply."
      >
        <div className="flex flex-col gap-4">
          {entry.files.map((f) => (
            <Field
              key={f.id}
              label={fileName(f.id)}
              htmlFor={`cf-${f.id}`}
              hint={Object.values(f.paths)[0]}
            >
              <Input
                id={`cf-${f.id}`}
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setResult(null);
                  void file.text().then((t) => setFiles((p) => ({ ...p, [f.id]: t })));
                }}
              />
            </Field>
          ))}
          {result ? (
            <ul className="flex flex-col gap-2 text-[13px]">
              {entry.files.some((f) => !(f.id in files)) ? (
                <li className="text-ink-3">
                  Not uploaded:{" "}
                  {entry.files
                    .filter((f) => !(f.id in files))
                    .map((f) => fileName(f.id))
                    .join(", ")}{" "}
                  — their settings were left out.
                </li>
              ) : null}
              {Object.entries(result.files).map(([id, text]) => (
                <li key={id}>
                  <a
                    download={fileName(id)}
                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
                    className="text-ink underline underline-offset-4"
                  >
                    Download {fileName(id)}
                  </a>
                </li>
              ))}
              {result.skipped
                .filter((s) => !s.endsWith("file provided")) // one line per file above instead
                .map((s) => (
                  <li key={s} className="text-ink-3">
                    Skipped — {s}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={run}
            loading={pending}
            disabled={Object.keys(files).length === 0}
          >
            Patch files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
