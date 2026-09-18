import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { configPath } from "./config.mjs";

export const statePath = () => join(dirname(configPath()), "state.json");

/** What this machine last applied per catalog game. Missing/corrupt file = nothing applied. */
export function loadState() {
  try {
    return existsSync(statePath())
      ? JSON.parse(readFileSync(statePath(), "utf8"))
      : { applied: {} };
  } catch {
    return { applied: {} };
  }
}

export function recordApplied(catalogId, { presetSlug, version }) {
  const s = loadState();
  s.applied[catalogId] = { presetSlug, version, at: new Date().toISOString() };
  writeFileSync(statePath(), JSON.stringify(s, null, 2) + "\n");
}

/** What the daemon reports to the vault: last write per game, tagged with this run's waiting/failed sets. */
export function reportable(state, { waiting = new Set(), failed = new Set() } = {}) {
  const out = {};
  const ids = new Set([...Object.keys(state.applied ?? {}), ...waiting, ...failed]);
  for (const id of ids) {
    const a = state.applied?.[id] ?? {};
    out[id] = {
      presetSlug: a.presetSlug ?? "",
      version: a.version ?? "",
      at: a.at ?? "",
      status: failed.has(id) ? "failed" : waiting.has(id) ? "waiting" : "applied",
    };
  }
  return out;
}
