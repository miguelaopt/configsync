/**
 * Runs the screenshot importer against real screenshots, outside the app, and prints what each
 * on-screen row became. For checking the prompt and the matching against a game's real menu.
 *
 *   pnpm exec tsx scripts/try-screenshot-import.mts cs2 ~/Pictures/cs2-*.png
 *
 * The "preset" is the catalog's default preset for the game, as a new account would have it.
 * Needs AI_VISION_API_KEY (read from .env); every run is a real, billed API call.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { buildHints, knownSettings, matchProposals } from "@/lib/ai/screenshot";
import { getCatalogGame } from "@/lib/catalog";
import type { CategoryWithSettings } from "@/lib/data/presets";
import { createAnthropicParser } from "@/lib/providers/anthropic-vision";
import type { ScreenshotImage } from "@/lib/providers/screenshot";
import { formatValue } from "@/lib/settings/types";

try {
  process.loadEnvFile(".env");
} catch {}

const [gameId, ...paths] = process.argv.slice(2);
const game = gameId ? getCatalogGame(gameId) : null;
const key = process.env.AI_VISION_API_KEY;
if (!game || paths.length === 0 || !key) {
  console.error(
    "Usage: tsx scripts/try-screenshot-import.mts <catalog id> <screenshots…>  (AI_VISION_API_KEY in .env)",
  );
  process.exit(1);
}

const categories = game.presets[0]!.categories.map((c, ci) => ({
  id: `c${ci}`,
  name: c.name,
  settings: c.settings.map((s, si) => ({
    ...s,
    id: `c${ci}s${si}`,
    value: s.value ?? null,
    options: s.options ?? null,
    min: s.min ?? null,
    max: s.max ?? null,
    step: s.step ?? null,
    unit: s.unit ?? null,
  })),
})) as unknown as CategoryWithSettings[];

const images: ScreenshotImage[] = paths.map((p) => ({
  bytes: new Uint8Array(readFileSync(p)),
  mimeType: p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg",
}));

const model = process.env.AI_VISION_MODEL || "claude-opus-5";
const parser = createAnthropicParser(new Anthropic({ apiKey: key, timeout: 300_000 }), model);
const known = knownSettings(game);
console.log(`Reading ${paths.map((p) => basename(p)).join(", ")} with ${model}…\n`);
const started = Date.now();
const { proposals, usage } = await parser.parse(images, buildHints(game, categories, known));
const rows = matchProposals(proposals, categories, known);

const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
const where = { preset: "preset", menu: "menu → new", screen: "NEW (screen)" } as const;
console.log(
  `${pad("on screen", 42)} ${pad("became", 13)} ${pad("setting", 42)} ${pad("category", 22)} value`,
);
for (const p of proposals) {
  const row =
    rows.find((r) => r.rawValue === p.rawValue && (r.name === p.name || p.ref != null)) ??
    rows.find((r) => r.name === p.name);
  const value = row?.value == null ? `?? "${p.rawValue}"` : formatValue(row.def, row.value);
  console.log(
    `${pad(p.name, 42)} ${pad(row ? where[row.source] : "-", 13)} ${pad(row?.name ?? "-", 42)} ${pad(row?.category ?? "-", 22)} ${value}`,
  );
}
const count = (s: string) => rows.filter((r) => r.source === s).length;
console.log(
  `\n${proposals.length} rows read → ${count("preset")} preset settings, ${count("menu")} from the game's menu, ${count("screen")} unknown; ${rows.filter((r) => r.value == null).length} values unreadable as their type.`,
);
console.log(
  `${usage.inputTokens} input + ${usage.outputTokens} output tokens, ${((Date.now() - started) / 1000).toFixed(0)} s.`,
);
