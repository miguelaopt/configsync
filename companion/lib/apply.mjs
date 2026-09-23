import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { api } from "./api.mjs";
import { resolveFilePath } from "./paths.mjs";
import { assertGameClosed } from "./procs.mjs";
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
 * Patch this machine's files with a preset. Refuses to write while the game is running, backs
 * each file up first, writes only what the server returned, and records the applied version when
 * `version` is given.
 *
 * The running check lives here, not in the commands: this is the only function that writes, so
 * every path through the CLI — `apply`, `watch`, `launch` and anything added later — inherits it.
 */
export async function applyPreset(
  config,
  game,
  presetSlug,
  { dryRun = false, log = console.log, version } = {},
) {
  // Once up front so a running game fails before the diff is printed, and once more below. A dry
  // run only reads, so it is allowed while the game is open — that is when you want to preview.
  if (!dryRun) await assertGameClosed(game);
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
  // The check that actually guarantees the contract, as late as possible: the game can have been
  // started while the server was computing the patch above.
  await assertGameClosed(game);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const wrote = [];
  for (const { id, path } of found) {
    if (!r.files[id]) continue;
    copyFileSync(path, `${path}.bak-${stamp}`);
    writeFileSync(path, r.files[id]);
    // { id, path }, not the bare path: callers that report to a GUI must be able to name the
    // file without leaking where it lives on disk.
    wrote.push({ id, path });
    log(`Wrote ${path} (backup: ${path}.bak-${stamp})`);
  }
  if (version) recordApplied(game.id, { presetSlug, version });
  return { ...r, wrote };
}
