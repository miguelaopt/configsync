"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { importGameConfigAction, previewGameConfigAction } from "@/lib/actions/catalog";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { configFileNames, matchConfigFile } from "@/lib/game-configs/match-file";
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { Dropzone } from "./dropzone";
import { ImportSteps } from "./import-steps";
import { recordImport } from "./recent-imports";
import type { PresetDoc } from "@/lib/import-export/schema";
import { formatValue } from "@/lib/settings/types";
import { Button } from "@/components/ui/button";
import { toastError } from "@/components/ui/toaster";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { plural } from "@/lib/utils/format";

type Preview = {
  missingFiles: string[];
  unmappedSettings: string[];
  warnings: string[];
  settingCount: number;
  perFile: Record<string, number>;
  preset: PresetDoc;
  readSettings: string[];
};
const MAX = 512 * 1024;

/** Pick a catalog game, choose its config files, preview what will be read, import as a new preset. */
export function GameFilesForm({
  catalog,
  userId,
}: {
  catalog: PublicCatalogEntry[];
  userId: string;
}) {
  const withFiles = catalog.filter((c) => c.files.length > 0);
  const [gameId, setGameId] = React.useState(withFiles[0]?.id ?? "");
  const [files, setFiles] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [reviewing, setReviewing] = React.useState(false);
  const [importedUrl, setImportedUrl] = React.useState<string | null>(null);
  const [filenames, setFilenames] = React.useState<Record<string, string>>({});
  const [reading, setReading] = React.useState(false);
  const readVersion = React.useRef(0);
  const game = withFiles.find((c) => c.id === gameId);

  React.useEffect(() => {
    if (!game || Object.keys(files).length === 0) return; // changeGame already cleared it
    let cancelled = false;
    void previewGameConfigAction({ catalogId: game.id, files })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) return toast.error(r.error);
        setPreview(r.data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't preview those files. Try choosing them again.");
      });
    return () => {
      cancelled = true;
    };
  }, [game, files]);

  const changeGame = (id: string) => {
    readVersion.current++;
    setGameId(id);
    setFiles({});
    setFilenames({});
    setPreview(null);
    setReading(false);
    setReviewing(false);
    setImportedUrl(null);
  };

  /** Matches dropped files to the catalog's file ids by name, so order does not matter. */
  const onDropped = async (dropped: File[]) => {
    if (!game) return;
    const version = ++readVersion.current;
    setReading(true);
    const loaded: Record<string, string> = {};
    const names: Record<string, string> = {};
    await Promise.all(
      dropped.map(async (f) => {
        const hit = matchConfigFile(game.files, f.name);
        if (!hit) {
          toast.error(`${f.name} isn't one of ${game.name}'s config files.`);
          return;
        }
        if (f.size > MAX) {
          toast.error("That file is larger than 512 KB — is it the right one?");
          return;
        }
        try {
          loaded[hit.id] = await f.text();
          names[hit.id] = f.name;
        } catch {
          toast.error(`Couldn't read ${f.name}. Try choosing it again.`);
        }
      }),
    );
    if (version !== readVersion.current) return;
    if (Object.keys(loaded).length) {
      setPreview(null);
      setFiles((prev) => ({ ...prev, ...loaded }));
      setFilenames((prev) => ({ ...prev, ...names }));
    }
    setReading(false);
  };

  const submit = () =>
    startTransition(async () => {
      if (!game) return;
      const r = await importGameConfigAction({
        catalogId: game.id,
        files,
        name: name || undefined,
      });
      if (!r.ok) {
        toastError(r.error);
        return;
      }
      toast.success("Preset imported from your game files");
      recordImport(userId, { name: Object.values(filenames).join(", "), presets: 1 });
      setImportedUrl(r.data.url);
    });

  if (!game) return <p className="text-[13px] text-ink-2">No catalog game has file support yet.</p>;
  if (importedUrl)
    return (
      <div>
        <ImportSteps step={3} />
        <div className="panel flex flex-col gap-4 p-6">
          <h2 className="flex items-center gap-2.5 text-[17px] font-semibold text-ink">
            <CheckCircle2 className="size-5 text-good" aria-hidden />
            Imported
          </h2>
          <p className="text-[14px] text-ink-2">Your new {game.name} preset is ready.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="primary">
              <Link href={importedUrl}>Open imported preset</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                changeGame(gameId);
                setName("");
              }}
            >
              Import more files
            </Button>
          </div>
        </div>
      </div>
    );
  if (reviewing && preview) {
    const recognised = new Set(preview.readSettings);
    const total = preview.preset.categories.reduce(
      (n, category) => n + category.settings.length,
      0,
    );
    return (
      <div>
        <ImportSteps step={2} />
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setReviewing(false)} disabled={pending}>
            <ArrowLeft /> Back to files
          </Button>
          <span className="text-[12px] text-ink-3">Step 2 of 3</span>
        </div>
        <div className="panel p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold text-ink">Review settings</h2>
          <p className="mt-1 text-[14px] text-ink-2">
            {game.name} · {name || `Imported ${new Date().toISOString().slice(0, 10)}`}
          </p>
          <p className="mt-3 text-[13px] text-ink-2">
            {plural(preview.settingCount, "setting")} read from your files.{" "}
            {plural(total - preview.settingCount, "setting")} will use catalog defaults, marked
            below. A new preset will be added when you confirm.
          </p>
          <p className="mt-2 text-[13px] text-ink-3">
            If this game is new to your vault, its catalog Default preset is also added.
          </p>
          {preview.preset.categories.map((category) => (
            <details key={category.name} open className="mt-5">
              <summary className="cursor-pointer text-[14px] font-medium text-ink">
                {category.name}
              </summary>
              <dl className="mt-2 divide-y divide-hairline border-y border-hairline">
                {category.settings.map((setting) => (
                  <div
                    key={setting.name}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 py-2.5 text-[13px]"
                  >
                    <dt className="text-ink-2">
                      {setting.name}
                      {!recognised.has(`${category.name} › ${setting.name}`) ? (
                        <span className="mt-1 block text-[11px] text-ink-3">Catalog default</span>
                      ) : null}
                    </dt>
                    <dd className="text-right break-words text-ink">
                      {formatValue(setting, setting.value ?? null)}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] mt-5 flex flex-wrap justify-end gap-2 rounded-lg border border-line bg-ground p-3 lg:bottom-0">
          <Button variant="ghost" onClick={() => setReviewing(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={pending}>
            Import preset <ArrowRight />
          </Button>
        </div>
      </div>
    );
  }
  const hintFor = (f: PublicCatalogEntry["files"][number]) =>
    f.paths["steam-windows"] ?? f.paths["epic-windows"] ?? Object.values(f.paths)[0];
  return (
    <div className="flex flex-col gap-5">
      <ImportSteps step={1} />
      <Field label="Game" htmlFor="gf-game">
        <Select value={gameId} onValueChange={changeGame}>
          <SelectTrigger id="gf-game">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {withFiles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Dropzone
        accept=".cfg,.vcfg,.txt,.ini,.json,text/plain"
        label={`Drop ${game.name}'s config files here`}
        hint={`Supported: ${game.files.flatMap(configFileNames).join(", ")}`}
        multiple
        onFiles={(dropped) => {
          void onDropped(dropped);
        }}
      >
        <Button variant="secondary">Choose files</Button>
      </Dropzone>

      <ul className="flex flex-col gap-1.5 text-[13px]">
        {game.files.map((f) => {
          const loaded = files[f.id] != null;
          return (
            <li key={f.id} className="flex items-center gap-2">
              {loaded ? (
                <Check className="size-4 shrink-0 text-good" aria-hidden />
              ) : (
                <span aria-hidden className="size-4 shrink-0 text-center text-ink-3">
                  ·
                </span>
              )}
              <span
                className={loaded ? "min-w-0 truncate font-mono text-ink" : "font-mono text-ink-3"}
              >
                {filenames[f.id] ?? f.id}
              </span>
              {loaded ? (
                <span className="shrink-0 text-ink-2">
                  {preview ? `${plural(preview.perFile[f.id] ?? 0, "setting")} found` : "Reading…"}
                </span>
              ) : (
                <span className="truncate text-ink-3">{hintFor(f)}</span>
              )}
            </li>
          );
        })}
      </ul>

      {preview ? (
        <div className="panel flex flex-col gap-1.5 p-4 text-[13px] text-ink-2" role="status">
          <p className="text-[15px] font-semibold text-ink">
            {game.name}
            {preview.settingCount > 0 ? " detected" : " files"}
          </p>
          <p className="text-ink">{plural(preview.settingCount, "setting")} recognised.</p>
          {preview.settingCount === 0 ? (
            <p>
              No values could be read. Check that these are the selected game&rsquo;s config files.
            </p>
          ) : null}
          {preview.unmappedSettings.length > 0 ? (
            <p>
              {plural(preview.unmappedSettings.length, "setting")} couldn&rsquo;t be matched (e.g.{" "}
              {preview.unmappedSettings[0]}) — add those by hand.
            </p>
          ) : null}
          {preview.missingFiles.length > 0 ? (
            <p>
              Not provided: {preview.missingFiles.join(", ")} — those settings keep their defaults.
            </p>
          ) : null}
          {preview.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

      <Field label="Preset name" htmlFor="gf-name" optional hint="Defaults to “Imported <date>”.">
        <Input id="gf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <Button
        variant="primary"
        size="lg"
        onClick={() => setReviewing(true)}
        loading={reading}
        disabled={!preview || preview.settingCount === 0}
      >
        Review {plural(preview?.settingCount ?? 0, "setting")} <ArrowRight />
      </Button>
    </div>
  );
}
