"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, FileJson, TriangleAlert } from "lucide-react";
import { parseImportFile, type ParseResult } from "@/lib/import-export/parse";
import { importAction, previewImportAction } from "@/lib/actions/import";
import type { ImportPreview, ImportStrategy } from "@/lib/data/import";
import { Dropzone } from "./dropzone";
import { ImportSteps } from "./import-steps";
import { ConflictReview } from "./conflict-review";
import { recordImport } from "./recent-imports";
import { Button } from "@/components/ui/button";
import { toastError } from "@/components/ui/toaster";
import { Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { plural } from "@/lib/utils/format";

type GameOption = { id: string; name: string; slug: string };
type Outcome = {
  createdGames: { id: string; slug: string; name: string }[];
  createdPresets: number;
  createdSettings: number;
  skippedPresets: number;
  replacedPresets: number;
  warnings: string[];
};

const STRATEGIES: { value: ImportStrategy; label: string; hint: string }[] = [
  { value: "keep-both", label: "Keep both", hint: "The incoming preset is added with a suffix." },
  { value: "skip", label: "Skip duplicates", hint: "Yours is left exactly as it is." },
  { value: "replace", label: "Replace existing", hint: "Yours is deleted, with its history." },
];

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

/**
 * Source → Review → Import. Nothing is written until the last step, and the review names every
 * preset that is about to land, including the ones that already exist.
 */
export function ImportForm({
  userId,
  games,
  defaultTargetId,
}: {
  userId: string;
  games: GameOption[];
  defaultTargetId?: string | null;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<{ name: string; size: number } | null>(null);
  const [parsed, setParsed] = React.useState<ParseResult | null>(null);
  const [preview, setPreview] = React.useState<(ImportPreview & { warnings: string[] }) | null>(
    null,
  );
  const [target, setTarget] = React.useState<string>(defaultTargetId ?? "new");
  const [strategy, setStrategy] = React.useState<ImportStrategy>("keep-both");
  const [decisions, setDecisions] = React.useState<Record<string, ImportStrategy>>({});
  const request = React.useRef(0);
  const [pasting, setPasting] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);

  const reset = () => {
    request.current++;
    setText("");
    setFile(null);
    setParsed(null);
    setPreview(null);
    setOutcome(null);
    setPasting(false);
    setStrategy("keep-both");
    setDecisions({});
  };

  /** Validate here, then ask the server what it would do — it is the one that knows your vault. */
  const load = React.useCallback(
    (raw: string, meta: { name: string; size: number } | null, targetId: string) => {
      const version = ++request.current;
      const result = parseImportFile(raw);
      setParsed(result);
      setFile(meta);
      if (!result.ok) {
        setPreview(null);
        return;
      }
      startTransition(async () => {
        const r = await previewImportAction({
          text: raw,
          targetGameId: targetId === "new" ? null : targetId,
        });
        if (version !== request.current) return;
        if (!r.ok) {
          setPreview(null);
          return toastError(r.error);
        }
        setPreview(r.data);
      });
    },
    [],
  );

  const onFiles = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toastError("That file is larger than 5 MB.");
    const version = ++request.current;
    void f
      .text()
      .then((raw) => {
        if (version !== request.current) return;
        setText(raw);
        setDecisions({});
        setStrategy("keep-both");
        load(raw, { name: f.name, size: f.size }, target);
      })
      .catch(() => toastError("Couldn't read that file. Try choosing it again."));
  };

  const changeTarget = (id: string) => {
    setTarget(id);
    setDecisions({});
    if (parsed?.ok) load(text, file, id);
  };

  const submit = () =>
    startTransition(async () => {
      const r = await importAction({
        text,
        targetGameId: target === "new" ? null : target,
        strategy,
        decisions,
      });
      if (!r.ok) return toastError(r.error);
      recordImport(userId, { name: file?.name ?? "Pasted JSON", presets: r.data.createdPresets });
      setOutcome({ ...r.data, warnings: r.data.warnings ?? [] });
      router.refresh();
    });

  // ---- Step 3: done ------------------------------------------------------
  if (outcome) {
    const nothing =
      outcome.createdPresets === 0 && outcome.skippedPresets === 0 && outcome.replacedPresets === 0;
    return (
      <div>
        <ImportSteps step={3} />
        <div className="panel flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 text-good" aria-hidden />
            <h2 className="text-[17px] font-semibold text-ink">
              {nothing ? "Nothing to import" : "Imported"}
            </h2>
          </div>
          <p className="text-[14px] text-ink-2">
            {plural(outcome.createdPresets, "preset")} added ·{" "}
            {plural(outcome.createdSettings, "setting")}
            {outcome.replacedPresets > 0 ? ` · ${outcome.replacedPresets} replaced` : ""}
            {outcome.skippedPresets > 0 ? ` · ${outcome.skippedPresets} skipped` : ""}
          </p>
          {outcome.createdGames.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {outcome.createdGames.map((g) => (
                <li key={g.id}>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/games/${g.slug}`}>Open {g.name}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {outcome.warnings.length > 0 ? <Warnings items={outcome.warnings} /> : null}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
            <Button asChild variant="ghost">
              <Link href="/games">Go to games</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Step 2: review ----------------------------------------------------
  if (parsed?.ok && preview) {
    const conflicts = preview.totals.conflicts;
    let willAdd = 0;
    let willReplace = 0;
    preview.games.forEach((game, gameIndex) =>
      game.presets.forEach((preset, presetIndex) => {
        const choice = decisions[`${gameIndex}:${presetIndex}`] ?? strategy;
        if (!preset.conflict || choice !== "skip") willAdd++;
        if (preset.conflict && choice === "replace") willReplace++;
      }),
    );
    return (
      <div className="flex flex-col gap-5">
        <ImportSteps step={2} />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={reset}
            className="flex cursor-pointer items-center gap-1.5 rounded-sm text-[13px] text-ink-3 hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden /> Choose another file
          </button>
          <span className="text-[12px] text-ink-3">Step 2 of 3</span>
        </div>

        <div className="panel flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <FileJson className="size-5 shrink-0 text-accent-text" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-ink">
                {file?.name ?? "Pasted JSON"}
              </p>
              <p className="text-[13px] text-ink-3">
                ConfigSync export{file ? ` · ${kb(file.size)}` : ""}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Found</h3>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink">
              <span>{plural(preview.totals.games, "game")}</span>
              <span aria-hidden className="text-ink-3">
                ·
              </span>
              <span>{plural(preview.totals.presets, "preset")}</span>
              <span aria-hidden className="text-ink-3">
                ·
              </span>
              <span>{plural(preview.totals.settings, "setting")}</span>
            </p>
          </div>

          {preview.games.map((g, gameIndex) => (
            <div key={gameIndex}>
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                {g.name}
                <span className="text-[12px] font-normal text-ink-3">
                  {g.exists ? "already in your vault" : "new game"}
                </span>
              </h3>
              <ul className="mt-2 flex flex-col divide-y divide-hairline border-y border-hairline">
                {g.presets.map((p, presetIndex) => (
                  <li
                    key={presetIndex}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13px]"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                    <span className="text-ink-3">{plural(p.settingCount, "setting")}</span>
                    {p.conflict ? (
                      <ConflictReview
                        conflict={p.conflict}
                        incoming={parsed.file.games[gameIndex]!.presets[presetIndex]!}
                        exportedAt={parsed.file.exportedAt}
                        choice={decisions[`${gameIndex}:${presetIndex}`] ?? strategy}
                        onChoice={(choice) =>
                          setDecisions((current) => ({
                            ...current,
                            [`${gameIndex}:${presetIndex}`]: choice,
                          }))
                        }
                        disabled={pending}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {preview.warnings.length > 0 ? <Warnings items={preview.warnings} /> : null}
        </div>

        <div className="panel flex flex-col gap-4 p-5 sm:p-6">
          <h3 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            Import options
          </h3>

          {games.length > 0 ? (
            <label className="flex flex-col gap-1.5 text-[13px]">
              <span className="text-ink-2">Destination</span>
              <Select value={target} onValueChange={changeTarget} disabled={pending}>
                <SelectTrigger className="sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Games named in the file</SelectItem>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      Everything into {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}

          <fieldset disabled={pending} className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] text-ink-2">
              {conflicts > 0
                ? `${plural(conflicts, "preset")} already exist — what should happen?`
                : "If a preset name already exists"}
            </legend>
            {STRATEGIES.map((s) => (
              <label key={s.value} className="flex cursor-pointer items-start gap-2.5 text-[13px]">
                <input
                  type="radio"
                  name="strategy"
                  value={s.value}
                  checked={strategy === s.value}
                  onChange={() => {
                    setStrategy(s.value);
                    setDecisions({});
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  <span className="font-medium text-ink">{s.label}</span>
                  <span className="ml-2 text-ink-3">{s.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {willReplace > 0 ? (
            <p className="flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {plural(willReplace, "preset")} in your vault will be deleted, with their snapshot
              history and per-PC choices. This cannot be undone.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="primary" size="lg" loading={pending} onClick={submit}>
              {willAdd === 0 ? "Nothing to import" : `Import ${plural(willAdd, "preset")}`}
              <ArrowRight />
            </Button>
            <Button variant="ghost" onClick={reset} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Step 1: source ----------------------------------------------------
  return (
    <div>
      <ImportSteps step={1} />
      <div className="flex flex-col items-center gap-5">
        <Dropzone
          accept="application/json,.json"
          label="Drop a ConfigSync file here"
          hint=".json · ConfigSync exports"
          onFiles={onFiles}
        >
          <Button variant="secondary">Choose file</Button>
        </Dropzone>

        {!pasting ? (
          <button
            type="button"
            onClick={() => setPasting(true)}
            className="cursor-pointer rounded-sm text-[13px] text-ink-3 hover:text-ink"
          >
            or paste JSON
          </button>
        ) : (
          <div className="flex w-full max-w-[660px] flex-col gap-2">
            <Textarea
              rows={8}
              value={text}
              aria-label="JSON to import"
              placeholder='{ "format": "gamesettings-vault", … }'
              disabled={pending}
              onChange={(e) => setText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={!text.trim()}
                loading={pending}
                onClick={() => load(text, null, target)}
              >
                Review
              </Button>
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {parsed && !parsed.ok ? (
          <ul className="w-full max-w-[660px] rounded-lg bg-bad-soft px-4 py-3 text-[13px] text-bad">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function Warnings({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1 rounded-lg bg-note-soft px-4 py-3 text-[13px] text-note">
      {items.map((w) => (
        <li key={w}>{w}</li>
      ))}
    </ul>
  );
}
