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
