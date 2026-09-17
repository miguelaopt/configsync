"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileJson, TriangleAlert, Upload, XCircle } from "lucide-react";
import { parseImportFile, summarizeFile, type ParseResult } from "@/lib/import-export/parse";
import { importAction } from "@/lib/actions/import";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type GameOption = { id: string; name: string; slug: string };
type Outcome = {
  createdGames: { id: string; slug: string; name: string }[];
  createdPresets: number;
  createdSettings: number;
  warnings: string[];
};

/**
 * Import flow: pick/drop/paste a file → validated locally with the same parser the server uses →
 * preview counts → choose destination → import. Nothing is written until the last step.
 */
export function ImportForm({
  games,
  defaultTargetId,
}: {
  games: GameOption[];
  defaultTargetId?: string | null;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParseResult | null>(null);
  const [target, setTarget] = React.useState<string>(defaultTargetId ?? "new");
  const [dragging, setDragging] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Debounced local validation; the same parser runs again on the server.
  React.useEffect(() => {
    if (!text.trim()) return;
    const t = setTimeout(() => setParsed(parseImportFile(text)), 150);
    return () => clearTimeout(t);
  }, [text]);

  const updateText = (value: string) => {
    setText(value);
    if (!value.trim()) setParsed(null);
  };

  const readFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Files must be 5 MB or smaller.");
    setFileName(file.name);
    updateText(await file.text());
    setOutcome(null);
  };

  const submit = () =>
    startTransition(async () => {
      const result = await importAction({ text, targetGameId: target === "new" ? null : target });
      if (!result.ok) {
        toast.error(result.error.split("\n")[0]);
        return;
      }
      setOutcome(result.data);
      toast.success("Import complete");
      router.refresh();
    });

  if (outcome) {
    const summary = summarizeFile(
      parsed && parsed.ok
        ? parsed.file
        : { format: "gamesettings-vault", version: 1, kind: "library", games: [] },
    );
    return (
      <div className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg">Imported</h2>
            <p className="mt-1 text-[13px] text-ink-2">
              {plural(outcome.createdPresets, "preset")} and{" "}
              {plural(outcome.createdSettings, "setting")} added
              {outcome.createdGames.length
                ? ` across ${plural(outcome.createdGames.length, "new game")}`
                : ""}
              .
              {summary.games > outcome.createdGames.length && target === "new"
                ? " Presets for games you already had were added to those games."
                : ""}
            </p>
            {outcome.createdGames.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {outcome.createdGames.map((g) => (
                  <li key={g.id}>
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/games/${g.slug}`}>Open {g.name}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : target !== "new" ? (
              <Button asChild variant="secondary" size="sm" className="mt-3">
                <Link href={`/games/${games.find((g) => g.id === target)?.slug ?? ""}`}>
                  Open game
                </Link>
              </Button>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOutcome(null);
                  updateText("");
                  setFileName(null);
                }}
              >
                Import another file
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/games">Go to games</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void readFile(f);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft/30" : "border-line",
        )}
      >
        <FileJson className="size-7 text-ink-3" aria-hidden />
        <p className="text-[13px] text-ink-2">
          Drop a ConfigSync{" "}
          <code className="rounded-xs bg-raised px-1 py-0.5 font-mono text-xs">.json</code> file
          here
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = "";
          }}
          aria-label="Choose a file"
        />
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload /> Choose file
        </Button>
        {fileName ? <p className="text-xs text-ink-3">{fileName}</p> : null}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-[13px] text-ink-2 select-none hover:text-ink">
          Or paste JSON
        </summary>
        <Textarea
          value={text}
          onChange={(e) => {
            updateText(e.target.value);
            setFileName(null);
          }}
          rows={8}
          placeholder='{"format": "gamesettings-vault", "version": 1, …}'
          className="mt-2 font-mono text-xs"
          aria-label="JSON to import"
          spellCheck={false}
        />
      </details>

      {parsed ? (
        parsed.ok ? (
          <div className="rounded-md border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">Looks good</p>
                <FilePreview file={parsed.file} />
                {parsed.warnings.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-2">
                    {parsed.warnings.map((w) => (
                      <li key={w} className="inline-flex items-center gap-1.5">
                        <TriangleAlert className="size-3.5 text-accent" aria-hidden /> {w}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="import-target" className="text-[13px] font-medium">
                  Import into
                </label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger id="import-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Games named in the file (create if missing)</SelectItem>
                    {games.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-ink-3">
                  Import only adds. Existing games and presets are never changed or overwritten.
                </p>
              </div>
              <Button variant="primary" onClick={submit} loading={pending}>
                <Upload /> Import
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-bad/40 bg-bad-soft p-4" role="alert">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">This file can’t be imported yet</p>
                <p className="mt-0.5 text-xs text-ink-2">
                  Nothing was changed. Fix the problems below and try again.
                </p>
                <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto font-mono text-xs text-ink">
                  {parsed.errors.map((e, i) => (
                    <li key={i} className="break-words">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

function FilePreview({ file }: { file: import("@/lib/import-export/schema").ExportFile }) {
  const s = summarizeFile(file);
  return (
    <div className="mt-1 text-[13px] text-ink-2">
      <p>
        {plural(s.games, "game")}, {plural(s.presets, "preset")}, {plural(s.settings, "setting")}
        {file.exportedAt ? ` · exported ${new Date(file.exportedAt).toLocaleDateString()}` : ""}
      </p>
      <ul className="mt-2 flex flex-col gap-0.5">
        {file.games.slice(0, 8).map((g, i) => (
          <li key={i} className="truncate">
            <span className="text-ink">{g.name}</span>
            <span className="text-ink-3">
              {" "}
              — {g.presets.map((p) => p.name).join(", ") || "no presets"}
            </span>
          </li>
        ))}
        {file.games.length > 8 ? (
          <li className="text-ink-3">…and {file.games.length - 8} more</li>
        ) : null}
      </ul>
    </div>
  );
}
