"use client";
import * as React from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Archive,
  Download,
  FileArchive,
  FileJson,
  FileText,
  HardDriveDownload,
  History,
  Info,
  MoreHorizontal,
  Settings2,
  Table,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/dashboard/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createRecentStore } from "@/lib/recent-store";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";

type Format = "json" | "md" | "csv" | "zip";
type Totals = { games: number; presets: number; settings: number };

const FORMATS: {
  format: Exclude<Format, "zip">;
  label: string;
  icon: React.ElementType;
  hint: string;
}[] = [
  {
    format: "json",
    label: "JSON",
    icon: FileJson,
    hint: "Complete and re-importable. This is your full backup, including all games, presets and settings.",
  },
  {
    format: "md",
    label: "Markdown",
    icon: FileText,
    hint: "Readable in any note-taking app or Markdown viewer. Great for documentation.",
  },
  {
    format: "csv",
    label: "CSV",
    icon: Table,
    hint: "One row per setting, ideal for spreadsheets and analysis.",
  },
];

const FORMAT_ICON: Record<Format, React.ElementType> = {
  json: FileJson,
  md: FileText,
  csv: Table,
  zip: FileArchive,
};

const recentSchema = z.object({
  name: z.string(),
  format: z.enum(["json", "md", "csv", "zip"]),
  archived: z.boolean(),
  games: z.number(),
  presets: z.number(),
  settings: z.number(),
  bytes: z.number(),
  at: z.string().datetime(),
});
type RecentExport = z.infer<typeof recentSchema>;
const recent = createRecentStore("exports", recentSchema);

const exportUrl = (format: Format, archived: boolean) =>
  `/api/export?scope=library&format=${format}${archived ? "&archived=1" : ""}`;

/** Fetches the file so we know its name and size, then hands it to the browser as a download. */
async function download(format: Format, archived: boolean): Promise<RecentExport> {
  const res = await fetch(exportUrl(format, archived));
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Export failed.");
  const blob = await res.blob();
  const name =
    /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
    `configsync-library.${format}`;
  const [games = 0, presets = 0, settings = 0] = (res.headers.get("X-Export-Counts") ?? "")
    .split(",")
    .map(Number);
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return {
    name,
    format,
    archived,
    games,
    presets,
    settings,
    bytes: blob.size,
    at: new Date().toISOString(),
  };
}

const bytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
const when = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return sameDay
    ? `Today, ${time}`
    : `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
};

/** The whole /export page below the title: options, the ZIP button, the format rows, recent exports. */
export function LibraryExport({ userId, totals }: { userId: string; totals: Totals }) {
  const [archived, setArchived] = React.useState(false);
  const [busy, setBusy] = React.useState<Format | null>(null);
  const items = recent.useItems(userId);
  const counts = `${plural(totals.games, "game")} · ${plural(totals.presets, "preset")} · ${plural(totals.settings, "setting")}`;

  const run = (format: Format, includeArchived = archived) => {
    setBusy(format);
    download(format, includeArchived)
      .then((item) => recent.add(userId, item))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setBusy(null));
  };

  return (
    <>
      <PageHeader
        title="Export"
        description="You own your data. Export your games, presets and settings any time in open formats — take it with you, no matter where you go."
        actions={
          <>
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
                loading={busy === "zip"}
                onClick={() => run("zip")}
              >
                <Download /> Download all as ZIP
              </Button>
              <span className="text-[12px] text-ink-3">{counts}</span>
            </div>
            <div className="panel flex flex-col gap-2 px-4 py-3">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Settings2 className="size-4 text-accent-text" aria-hidden /> Export options
              </p>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink">
                <Checkbox checked={archived} onCheckedChange={(v) => setArchived(v === true)} />
                Include archived presets
                <Tooltip content="Archived games and presets stay out of exports unless you tick this.">
                  <span
                    className="inline-flex text-ink-3"
                    tabIndex={0}
                    aria-label="What this includes"
                  >
                    <Info className="size-3.5" />
                  </span>
                </Tooltip>
              </label>
              <p className="text-[12px] text-ink-3">Includes presets you&rsquo;ve archived.</p>
            </div>
          </>
        }
      />

      <Panel
        icon={<HardDriveDownload />}
        title="Your whole library"
        subtitle={`${counts}. Export your data in open formats — choose the one that works best for you.`}
      >
        <ul className="flex flex-col gap-3">
          {FORMATS.map((f) => {
            const primary = f.format === "json";
            return (
              <li
                key={f.format}
                className={cn(
                  "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center",
                  primary ? "border-accent/50 bg-accent-soft/20" : "border-line bg-ground/40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    primary ? "bg-accent-soft text-accent-text" : "bg-raised text-ink-2",
                  )}
                >
                  <f.icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[16px] font-semibold text-ink">
                    {f.label}
                    {primary ? <Badge variant="accent">Recommended</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-2">{f.hint}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Button
                    variant={primary ? "primary" : "secondary"}
                    loading={busy === f.format}
                    onClick={() => run(f.format)}
                  >
                    <Download /> Download
                  </Button>
                  <span className="w-20 text-[12px] text-ink-3">
                    {archived ? "incl. archived" : "active only"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex items-start gap-2.5 rounded-xl border border-line px-4 py-3 text-[13px] text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          Exports never include your password or session data. JSON files can be re-imported back
          into ConfigSync on any account.
        </p>
      </Panel>

      <Panel
        id="recent-exports"
        icon={<History />}
        title="Recent exports"
        subtitle="Your latest exports from this browser. Downloading again exports today's data."
        className="mt-5"
      >
        {items.length ? (
          <ul className="divide-y divide-hairline">
            {items.map((item, index) => {
              const Icon = FORMAT_ICON[item.format];
              return (
                <li
                  key={`${item.at}-${index}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                >
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-raised text-ink-2"
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{item.name}</p>
                    <p className="text-[12px] text-ink-3">
                      {plural(item.games, "game")} · {plural(item.presets, "preset")} ·{" "}
                      {plural(item.settings, "setting")}
                      {item.archived ? " · incl. archived" : ""}
                    </p>
                  </div>
                  <div className="w-40 text-[12px] text-ink-3">
                    <p>
                      <time dateTime={item.at}>{when(item.at)}</time>
                    </p>
                    <p>{bytes(item.bytes)}</p>
                  </div>
                  <Button
                    size="sm"
                    loading={busy === item.format}
                    onClick={() => run(item.format, item.archived)}
                  >
                    <Download /> Download
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label="More">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => recent.removeAt(userId, index)}>
                        <Trash2 /> Remove from list
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-ink-3">
            <Archive className="size-4" aria-hidden /> Your exports will appear here.
          </p>
        )}
      </Panel>
    </>
  );
}
