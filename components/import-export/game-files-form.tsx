"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importGameConfigAction, previewGameConfigAction } from "@/lib/actions/catalog";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
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
        toast.error(r.error);
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
      {game.files.map((f) => (
        <Field key={f.id} label={`${f.id} file`} htmlFor={`gf-${f.id}`} hint={hintFor(f)}>
          <Input
            id={`gf-${f.id}`}
            type="file"
            onChange={(e) => onFile(f.id, e.target.files?.[0])}
          />
        </Field>
      ))}
      {preview ? (
        <div className="rounded-sm border border-line p-3 text-[13px] text-ink-2" role="status">
          <p className="text-ink">{plural(preview.settingCount, "setting")} will be created.</p>
          {preview.missingFiles.length > 0 ? (
            <p>
              Not provided: {preview.missingFiles.join(", ")} — those settings keep their defaults.
            </p>
          ) : null}
          {preview.unmappedSettings.length > 0 ? (
            <p>
              {plural(preview.unmappedSettings.length, "setting")} aren’t stored in files (e.g.{" "}
              {preview.unmappedSettings[0]}); enter them by hand.
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
        onClick={submit}
        loading={pending}
        disabled={Object.keys(files).length === 0}
      >
        Import as preset
      </Button>
    </div>
  );
}
