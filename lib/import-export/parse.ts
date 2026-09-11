import { z } from "zod";
import { exportFileSchema, FORMAT_ID, FORMAT_VERSION, type ExportFile } from "./schema";
import { valueSchemaFor } from "@/lib/settings/types";

export type ParseResult =
  { ok: true; file: ExportFile; warnings: string[] } | { ok: false; errors: string[] };

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Parses and validates an import file. Never throws.
 * Structural problems are errors (file rejected). Value/type mismatches are also errors —
 * we would rather ask the user to fix the file than silently drop data.
 */
export function parseImportFile(raw: string): ParseResult {
  if (raw.length > MAX_BYTES) {
    return { ok: false, errors: ["File is larger than 5 MB."] };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      errors: ["This isn't valid JSON. Export files end in .json and start with {."],
    };
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { ok: false, errors: ["Expected a JSON object at the top level."] };
  }
  const obj = json as Record<string, unknown>;
  if (obj.format !== FORMAT_ID) {
    return {
      ok: false,
      errors: [`Not a GameSettings Vault file (missing "format": "${FORMAT_ID}").`],
    };
  }
  if (obj.version !== FORMAT_VERSION) {
    return {
      ok: false,
      errors: [
        `Unsupported file version ${String(obj.version)}. This build understands version ${FORMAT_VERSION}.`,
      ],
    };
  }

  const parsed = exportFileSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, errors: formatZodIssues(parsed.error) };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  parsed.data.games.forEach((game, gi) => {
    game.presets.forEach((preset, pi) => {
      preset.categories.forEach((category, ci) => {
        category.settings.forEach((setting, si) => {
          if (setting.value == null) return;
          const check = valueSchemaFor(setting).safeParse(setting.value);
          if (!check.success) {
            const where = `${game.name} › ${preset.name} › ${category.name} › ${setting.name}`;
            errors.push(
              `${where}: value ${JSON.stringify(setting.value)} is not valid for type "${setting.type}" (${check.error.issues[0]?.message ?? "invalid"}). [games[${gi}].presets[${pi}].categories[${ci}].settings[${si}]]`,
            );
          }
        });
      });
      if (preset.categories.length === 0)
        warnings.push(`Preset "${preset.name}" has no categories.`);
    });
    if (game.presets.length === 0) warnings.push(`Game "${game.name}" has no presets.`);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, file: parsed.data, warnings };
}

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 20).map((issue) => {
    const path = issue.path.length ? issue.path.map(String).join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

/** Counts for confirmation UI. */
export function summarizeFile(file: ExportFile) {
  let presets = 0;
  let settings = 0;
  for (const g of file.games) {
    presets += g.presets.length;
    for (const p of g.presets) for (const c of p.categories) settings += c.settings.length;
  }
  return { games: file.games.length, presets, settings };
}
