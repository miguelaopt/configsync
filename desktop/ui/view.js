/**
 * What the window shows, as pure functions of what csync printed — so all of it runs under
 * `node --test` on any machine, without Tauri.
 */

export const SITE = "https://configsync.app";

const REINSTALL =
  "The companion answered with something this app cannot read. Reinstall ConfigSync.";

/** One `csync … --json` run: the answer, or the CLI's own error message, never a parse exception. */
export function parseResult({ code, stdout }) {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    return { ok: false, error: REINSTALL };
  }
  if (data && typeof data.error === "string") return { ok: false, error: data.error };
  if (code !== 0) return { ok: false, error: REINSTALL };
  return { ok: true, data };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

/** "applied today at 14:02", "applied 21 Sep at 09:05" or "never applied", in local time. */
export function appliedLabel(applied, now = new Date()) {
  const at = applied?.at ? new Date(applied.at) : null;
  if (!at || Number.isNaN(at.getTime())) return "never applied";
  const day =
    at.toDateString() === now.toDateString() ? "today" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
  return `applied ${day} at ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** One row of the game list. A game missing here stays listed, or it looks like a bug. */
export function gameView(game, now = new Date()) {
  const target = game.target ?? null;
  const outdated = Boolean(
    target &&
    game.applied &&
    (game.applied.presetSlug !== target.presetSlug || game.applied.version !== target.version),
  );
  return {
    id: game.id,
    name: game.name,
    dim: !game.installed,
    files: game.installed
      ? `${game.files} ${game.files === 1 ? "file" : "files"}`
      : "not installed here",
    preset: target ? target.presetName : "No Default preset yet",
    applied: game.installed
      ? appliedLabel(game.applied, now) + (outdated ? " · out of date" : "")
      : "",
    canApply: Boolean(game.installed && target),
    canImport: Boolean(game.installed),
  };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function applyMessage(r) {
  const parts = [
    r.wrote.length
      ? `Wrote ${plural(r.wrote.length, "file", "files")}, backed up first`
      : "Nothing to write",
  ];
  if (r.skipped.length)
    parts.push(`${plural(r.skipped.length, "setting is", "settings are")} not stored in files`);
  return parts.join(" · ");
}

export function importMessage(r) {
  const parts = ["Imported"];
  if (r.unmappedSettings)
    parts.push(`${plural(r.unmappedSettings, "setting", "settings")} to enter by hand`);
  if (r.missingFiles.length)
    parts.push(`${plural(r.missingFiles.length, "file", "files")} not found`);
  parts.push(...r.warnings);
  return parts.join(" · ");
}
