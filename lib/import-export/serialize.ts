import { FORMAT_ID, FORMAT_VERSION, type ExportFile, type GameDoc } from "./schema";
import { formatValue, type SettingValue } from "@/lib/settings/types";

export const APP_VERSION = "0.1.0";

export function buildExportFile(games: GameDoc[], kind: ExportFile["kind"]): ExportFile {
  return {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    kind,
    exportedAt: new Date().toISOString(),
    app: { name: "ConfigSync", version: APP_VERSION },
    games,
  };
}

export function toJson(file: ExportFile): string {
  return JSON.stringify(file, null, 2) + "\n";
}

/** Markdown export of one or more games. Mirrors the in-app hierarchy. */
export function toMarkdown(games: GameDoc[]): string {
  const out: string[] = [];
  for (const game of games) {
    out.push(`# ${game.name}`);
    const meta = [
      game.platforms.length ? `Platforms: ${game.platforms.join(", ")}` : null,
      game.tags.length ? `Tags: ${game.tags.join(", ")}` : null,
    ].filter(Boolean);
    if (meta.length) out.push("", meta.join("  \n"));
    if (game.notes) out.push("", game.notes);
    for (const preset of game.presets) {
      out.push("", `## ${preset.name}${preset.isDefault ? " (default)" : ""}`);
      if (preset.description) out.push("", preset.description);
      for (const category of preset.categories) {
        out.push("", `### ${category.name}`, "");
        if (category.settings.length === 0) out.push("_No settings_");
        for (const s of category.settings) {
          out.push(`- ${s.name}: ${formatValue(s, s.value as SettingValue | null)}`);
        }
      }
      if (preset.notes) out.push("", `> ${preset.notes.replace(/\n/g, "\n> ")}`);
    }
    out.push("");
  }
  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

/** CSV export: one row per setting. RFC 4180 quoting. */
export function toCsv(games: GameDoc[]): string {
  const header = ["game", "preset", "category", "setting", "type", "value", "unit", "notes"];
  const rows: string[][] = [header];
  for (const game of games) {
    for (const preset of game.presets) {
      for (const category of preset.categories) {
        for (const s of category.settings) {
          rows.push([
            game.name,
            preset.name,
            category.name,
            s.name,
            s.type,
            formatValue(s, s.value as SettingValue | null),
            s.unit ?? "",
            s.notes ?? "",
          ]);
        }
      }
    }
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(v: string) {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
