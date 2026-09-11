/**
 * Copy-to-clipboard formatting. Works on the interchange documents so the same code
 * serves "copy setting", "copy category", "copy preset" and "copy game".
 */
import type { CategoryDoc, SettingDoc } from "@/lib/import-export/schema";
import { formatValue, type SettingValue } from "@/lib/settings/types";

export const COPY_FORMATS = ["plain", "markdown", "json"] as const;
export type CopyFormat = (typeof COPY_FORMATS)[number];

export const COPY_FORMAT_LABELS: Record<CopyFormat, string> = {
  plain: "Plain text",
  markdown: "Markdown",
  json: "JSON",
};

export type CopyPayload = {
  /** Optional heading, e.g. "GTA V — Main Setup". */
  title?: string;
  categories: Pick<CategoryDoc, "name" | "settings">[];
};

export function formatForCopy(payload: CopyPayload, format: CopyFormat): string {
  switch (format) {
    case "plain":
      return toPlain(payload);
    case "markdown":
      return toMarkdownList(payload);
    case "json":
      return toJsonObject(payload);
  }
}

const display = (s: SettingDoc) => formatValue(s, s.value as SettingValue | null);

function toPlain({ title, categories }: CopyPayload): string {
  const blocks: string[] = [];
  if (title) blocks.push(title);
  const multi = categories.length > 1;
  for (const c of categories) {
    const lines = c.settings.map((s) => `${s.name}: ${display(s)}`);
    blocks.push(multi ? [`[${c.name}]`, ...lines].join("\n") : lines.join("\n"));
  }
  return blocks.filter(Boolean).join("\n\n");
}

function toMarkdownList({ title, categories }: CopyPayload): string {
  const blocks: string[] = [];
  if (title) blocks.push(`## ${title}`);
  for (const c of categories) {
    const lines = c.settings.map((s) => `- ${s.name}: ${display(s)}`);
    blocks.push([`### ${c.name}`, ...lines].join("\n"));
  }
  return blocks.join("\n\n");
}

function toJsonObject({ categories }: CopyPayload): string {
  const toObject = (settings: SettingDoc[]) => {
    const obj: Record<string, unknown> = {};
    for (const s of settings) obj[uniqueKey(camelKey(s.name), obj)] = s.value ?? null;
    return obj;
  };
  const data =
    categories.length === 1
      ? toObject(categories[0]!.settings)
      : (() => {
          const obj: Record<string, unknown> = {};
          for (const c of categories) obj[uniqueKey(camelKey(c.name), obj)] = toObject(c.settings);
          return obj;
        })();
  return JSON.stringify(data, null, 2);
}

/** "ADS Sensitivity" → "adsSensitivity"; "V-Sync" → "vSync"; "2x MSAA" → "_2xMsaa". */
export function camelKey(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "value";
  const key = words
    .map((w, i) => {
      const lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  return /^[0-9]/.test(key) ? `_${key}` : key;
}

function uniqueKey(key: string, obj: Record<string, unknown>) {
  if (!(key in obj)) return key;
  for (let i = 2; ; i++) if (!(`${key}${i}` in obj)) return `${key}${i}`;
}
