import type { Metadata } from "next";
import { Download, FileJson, FileText, Table } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Export" };

const FORMATS = [
  {
    format: "json",
    label: "JSON",
    icon: FileJson,
    hint: "Complete and re-importable. This is your backup.",
  },
  {
    format: "md",
    label: "Markdown",
    icon: FileText,
    hint: "Readable in any notes app or on GitHub.",
  },
  { format: "csv", label: "CSV", icon: Table, hint: "One row per setting, for spreadsheets." },
] as const;

export default async function ExportPage() {
  const user = await requireUser();
  const { totals } = await getDashboardData(user.id);
  return (
    <Page size="md">
      <PageHeader
        title="Export"
        description="Your data is yours. Download everything, any time, in open formats. Single games and presets can be exported from their own menus."
      />
      <p className="mb-4 text-[13px] text-ink-2">
        Your library: {plural(totals.games, "game")}, {plural(totals.presets, "preset")},{" "}
        {plural(totals.settings, "setting")}.
      </p>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {FORMATS.map((f) => (
          <li key={f.format} className="flex items-center gap-4 py-4">
            <f.icon className="size-5 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">{f.label}</p>
              <p className="text-xs text-ink-3">{f.hint}</p>
            </div>
            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
              <Button asChild variant={f.format === "json" ? "primary" : "secondary"} size="sm">
                <a href={`/api/export?scope=library&format=${f.format}`} download>
                  <Download /> Download
                </a>
              </Button>
              <a
                href={`/api/export?scope=library&format=${f.format}&archived=1`}
                className="text-xs text-ink-3 underline-offset-4 hover:text-ink hover:underline"
                download
              >
                incl. archived
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs leading-relaxed text-ink-3">
        Exports never include your password or session. JSON files can be imported back into any
        GameSettings Vault instance, including one you host yourself.
      </p>
    </Page>
  );
}
