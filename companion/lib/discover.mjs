import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { configPath } from "./config.mjs";
import { documentsFor, steamUserdata } from "./paths.mjs";

/**
 * Finding a game's config files when the catalog does not know it yet.
 *
 * `docs/catalog.md` says to change one setting in the game, quit, and diff the file. That needs
 * someone who owns the game — so this does the diffing for them. Nothing here parses: a line
 * diff names the exact key that moved, and it works for formats the catalog cannot read yet,
 * which is the whole point of discovery.
 */

/** Config-ish, and small enough to be settings rather than data. */
const CONFIG_EXT = /\.(ini|cfg|vcfg|conf|txt|json|xml|yaml|yml)$/i;
/** Directories that are never settings, and are where the file counts explode. */
const SKIP_DIR =
  /^(logs?|cache|crashes|crashreport\w*|dumps|screenshots|replays|demos|videos|movies|shaders?cache|backup|temp|tmp|\.git|node_modules)$/i;
const MAX_BYTES = 1024 * 1024;
const MAX_DEPTH = 4;
const MAX_FILES = 200;

/** A NUL byte in the first 8 KB — good enough to keep save files and images out. */
const looksBinary = (buf) => buf.subarray(0, 8192).includes(0);

export function isConfigCandidate(name, size) {
  return CONFIG_EXT.test(name) && size > 0 && size <= MAX_BYTES;
}

/** Every config-ish file under `root`, depth- and count-capped so a game install cannot hang it. */
export function walkConfigFiles(
  root,
  { depth = MAX_DEPTH, out = [], budget = { n: MAX_FILES } } = {},
) {
  if (!root || depth < 0 || budget.n <= 0 || !existsSync(root)) return out;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out; // unreadable directory: not ours to worry about
  }
  for (const e of entries) {
    if (budget.n <= 0) break;
    const path = join(root, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIR.test(e.name)) walkConfigFiles(path, { depth: depth - 1, out, budget });
      continue;
    }
    if (!e.isFile()) continue;
    let size;
    try {
      size = statSync(path).size;
    } catch {
      continue;
    }
    if (!isConfigCandidate(e.name, size)) continue;
    out.push({ path, size });
    budget.n -= 1;
  }
  return out;
}

/**
 * The user profile a game writes into: the real one on Windows, the Proton/Heroic prefix's on
 * Linux. `documentsFor` already resolves both, so this takes the parent of what it returns
 * rather than rebuilding prefix lookup here.
 */
function profileDir(game) {
  const kind = `${game.source}-${process.platform === "win32" ? "windows" : "linux"}`;
  const documents = documentsFor(kind, {
    steamAppId: game.source === "steam" ? game.appId : undefined,
    epicAppName: game.source === "epic" ? game.appId : undefined,
  });
  return documents ? dirname(documents) : null;
}

/**
 * Where a game of this shape keeps settings. Real conventions, not guesses: Source under Steam's
 * userdata, Unreal under Documents/My Games and AppData/Local, Respawn under Saved Games, and a
 * few games simply beside the executable.
 */
export function discoverRoots(game) {
  const roots = [];
  const add = (label, path) => path && existsSync(path) && roots.push({ label, path });
  const userdata = steamUserdata();
  if (game.source === "steam" && userdata)
    add("steam userdata", join(userdata, String(game.appId)));
  const profile = profileDir(game);
  if (profile)
    // These hold a folder per game, so only the game's own folder is searched — AppData\Local
    // whole would be tens of thousands of files belonging to everything else installed.
    for (const [label, parent] of [
      ["documents", join(profile, "Documents", "My Games")],
      ["appdata local", join(profile, "AppData", "Local")],
      ["appdata roaming", join(profile, "AppData", "Roaming")],
      ["saved games", join(profile, "Saved Games")],
    ])
      for (const dir of gameDirsIn(parent, game.name)) add(label, dir);
  add("install dir", game.installDir);
  return roots;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Loose match: "Rocket League" ↔ "RocketLeague", "Apex" ↔ "ApexLegends". */
const looksLike = (dir, name) => {
  const [a, b] = [slug(dir), slug(name)];
  return a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));
};

/**
 * Children of `parent` that belong to this game — and, one level down, publisher folders like
 * `Saved Games/Respawn/Apex`, where the top name is the studio rather than the game.
 */
export function gameDirsIn(parent, name, { depth = 1 } = {}) {
  if (!parent || !existsSync(parent)) return [];
  let entries;
  try {
    entries = readdirSync(parent, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
  const hits = [];
  for (const e of entries) {
    if (looksLike(e.name, name)) hits.push(join(parent, e.name));
    else if (depth > 0 && !SKIP_DIR.test(e.name))
      hits.push(...gameDirsIn(join(parent, e.name), name, { depth: depth - 1 }));
  }
  return hits;
}

/** Snapshot the text of every candidate file under a game's roots. */
export function snapshot(game) {
  const files = {};
  for (const { path } of discoverRoots(game).flatMap((r) => walkConfigFiles(r.path))) {
    try {
      const buf = readFileSync(path);
      if (!looksBinary(buf)) files[path] = buf.toString("utf8");
    } catch {
      // vanished or unreadable between the walk and the read
    }
  }
  return { at: new Date().toISOString(), files };
}

/**
 * Lines that differ between two versions of one file. A set difference, not a real diff: when one
 * setting changes, its old line lands in `removed` and its new line in `added`, which is exactly
 * the key/value pair the catalog needs. Order changes are noise and stay out.
 */
export function diffLines(before, after) {
  const split = (s) => s.split(/\r?\n/).filter((l) => l.trim());
  const a = new Set(split(before));
  const b = new Set(split(after));
  return {
    removed: [...a].filter((l) => !b.has(l)),
    added: [...b].filter((l) => !a.has(l)),
  };
}

/**
 * Snapshots hold the contents of the player's config files, so they live beside the token with
 * the same 0600 permissions and never leave the machine on their own.
 */
export function snapshotPath(game) {
  return join(dirname(configPath()), "discover", `${game.source}-${game.appId}.json`);
}

export function saveSnapshot(game, snap) {
  const p = snapshotPath(game);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(snap), { mode: 0o600 });
  chmodSync(p, 0o600); // `mode` only applies when the file is created
  return p;
}

export function loadSnapshot(game) {
  const p = snapshotPath(game);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null; // corrupt snapshot: take a fresh one rather than fail
  }
}

/** Per-file line changes between a stored snapshot and the files as they are now. */
export function diffSnapshot(previous, current) {
  const paths = new Set([...Object.keys(previous.files), ...Object.keys(current.files)]);
  const changes = [];
  for (const path of [...paths].sort()) {
    const { removed, added } = diffLines(previous.files[path] ?? "", current.files[path] ?? "");
    if (removed.length || added.length) changes.push({ path, removed, added });
  }
  return changes;
}
