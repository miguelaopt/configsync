"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importGameConfigAction, previewGameConfigAction } from "@/lib/actions/catalog";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { ArrowRight, Check } from "lucide-react";
import { Dropzone } from "./dropzone";
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
};
const MAX = 512 * 1024;

/** Pick a catalog game, choose its config files, preview what will be read, import as a new preset. */
export function GameFilesForm({ catalog }: { catalog: PublicCatalogEntry[] }) {
  const router = useRouter();
  const withFiles = catalog.filter((c) => c.files.length > 0);
  const [gameId, setGameId] = React.useState(withFiles[0]?.id ?? "");
  const [files, setFiles] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [pending, startTransition] = React.useTransition();
  const game = withFiles.find((c) => c.id === gameId);

  React.useEffect(() => {
    if (!game || Object.keys(files).length === 0) return; // changeGame already cleared it
    let cancelled = false;
    void previewGameConfigAction({ catalogId: game.id, files }).then((r) => {
      if (cancelled) return;
      if (!r.ok) return toast.error(r.error);
      setPreview(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [game, files]);

  const changeGame = (id: string) => {
    setGameId(id);
    setFiles({});
    setPreview(null);
  };

  /** Matches dropped files to the catalog's file ids by name, so order does not matter. */
  const onDropped = (dropped: File[]) => {
    if (!game) return;
    for (const f of dropped) {
      const hit =
        game.files.find((c) => c.id.toLowerCase() === f.name.toLowerCase()) ??
        game.files.find((c) => f.name.toLowerCase().includes(c.id.toLowerCase().split(".")[0]!));
      if (!hit) {
        toast.error(`${f.name} isn't one of ${game.name}'s config files.`);
        continue;
      }
      onFile(hit.id, f);
    }
  };

  const onFile = (fileId: string, f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX) return toast.error("That file is larger than 512 KB — is it the right one?");
    void f.text().then((text) => setFiles((prev) => ({ ...prev, [fileId]: text })));
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
      router.push(r.data.url);
    });

  if (!game) return <p className="text-[13px] text-ink-2">No catalog game has file support yet.</p>;
  const hintFor = (f: PublicCatalogEntry["files"][number]) =>
    f.paths["steam-windows"] ?? f.paths["epic-windows"] ?? Object.values(f.paths)[0];
  return (
    <div className="flex flex-col gap-5">
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
        accept=".cfg,.txt,.ini,.json,text/plain"
        label={`Drop ${game.name}'s config files here`}
        hint={`Supported: ${game.files.map((f) => f.id).join(", ")}`}
        multiple
        onFiles={onDropped}
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
              <span className={loaded ? "font-mono text-ink" : "font-mono text-ink-3"}>{f.id}</span>
              {loaded ? (
                <span className="text-ink-2">
                  {plural(preview?.perFile[f.id] ?? 0, "setting")} found
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
          <p className="text-[15px] font-semibold text-ink">{game.name} detected</p>
          <p className="text-ink">{plural(preview.settingCount, "setting")} recognised.</p>
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
        onClick={submit}
        loading={pending}
        disabled={Object.keys(files).length === 0}
      >
        Review {plural(preview?.settingCount ?? 0, "setting")} <ArrowRight />
      </Button>
    </div>
  );
}
