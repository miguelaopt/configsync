import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { api } from "./api.mjs";
import { resolveFilePath } from "./paths.mjs";
import { recordApplied } from "./state.mjs";

/** Reads the game's config files present on this machine. */
export function readFiles(game, { log = console.log } = {}) {
  const files = {};
  const found = [];
  for (const f of game.files) {
    const hit = resolveFilePath(f, game);
    if (!hit) {
      log(`  ${f.id}: not found on this machine`);
      continue;
    }
    files[f.id] = readFileSync(hit.path, "utf8");
    found.push({ id: f.id, path: hit.path });
    log(`  ${f.id}: ${hit.path}`);
  }
  return { files, found };
}

/**
 * Patch this machine's files with a preset. Backs each file up first; writes only what the
 * server returned; records the applied version when `version` is given.
 */
export async function applyPreset(
  config,
  game,
  presetSlug,
  { dryRun = false, log = console.log, version } = {},
) {
  const { files, found } = readFiles(game, { log });
  if (found.length === 0) throw new Error(`No ${game.name} config files found on this machine.`);
  const r = await api(config).post("/apply", { catalogId: game.id, presetSlug, files });
  for (const [id, keys] of Object.entries(r.changed))
    log(
      `${id}: ${Object.entries(keys)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  for (const s of r.skipped) log(`Skipped — ${s}`);
  if (dryRun) return { ...r, wrote: [] };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const wrote = [];
  for (const { id, path } of found) {
    if (!r.files[id]) continue;
    copyFileSync(path, `${path}.bak-${stamp}`);
    writeFileSync(path, r.files[id]);
    wrote.push(path);
    log(`Wrote ${path} (backup: ${path}.bak-${stamp})`);
  }
  if (version) recordApplied(game.id, { presetSlug, version });
  return { ...r, wrote };
}
