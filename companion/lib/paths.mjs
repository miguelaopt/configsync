import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseVdf } from "./vdf.mjs";

const home = homedir();
const win = process.platform === "win32";

/** Steam installs, in the order we trust them. */
export function steamRoots() {
  const candidates = win
    ? [
        join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Steam"),
        join(process.env.ProgramFiles ?? "C:\\Program Files", "Steam"),
      ]
    : [
        join(home, ".steam", "steam"),
        join(home, ".local", "share", "Steam"),
        join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
      ];
  const seen = new Set();
  return candidates.filter((p) => {
    if (!existsSync(join(p, "steamapps"))) return false;
    const real = statSync(p).ino; // ~/.steam/steam is usually a symlink to ~/.local/share/Steam
    if (seen.has(real)) return false;
    seen.add(real);
    return true;
  });
}

/** All steamapps library folders (main + extra drives). */
export function steamLibraries() {
  const libs = [];
  for (const root of steamRoots()) {
    libs.push(join(root, "steamapps"));
    const vdf = join(root, "steamapps", "libraryfolders.vdf");
    if (!existsSync(vdf)) continue;
    const doc = parseVdf(readFileSync(vdf, "utf8")).libraryfolders ?? {};
    for (const entry of Object.values(doc))
      if (entry?.path) libs.push(join(entry.path, "steamapps"));
  }
  // ~/.steam/steam and the vdf's own path usually point at the same dir through a symlink.
  return [...new Set(libs.filter((p) => existsSync(p)).map((p) => realpathSync(p)))];
}

/** The most recently used Steam account's userdata dir. */
export function steamUserdata() {
  for (const root of steamRoots()) {
    const dir = join(root, "userdata");
    if (!existsSync(dir)) continue;
    const ids = readdirSync(dir).filter((d) => /^\d+$/.test(d) && d !== "0");
    if (ids.length === 0) continue;
    ids.sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs);
    return join(dir, ids[0]);
  }
  return null;
}

function protonDocuments(appId) {
  for (const lib of steamLibraries()) {
    const users = join(lib, "compatdata", String(appId), "pfx", "drive_c", "users");
    if (existsSync(users)) return join(users, "steamuser", "Documents");
  }
  return null;
}

function heroicDocuments(appName) {
  const cfg = join(
    process.env.XDG_CONFIG_HOME ?? join(home, ".config"),
    "heroic",
    "GamesConfig",
    `${appName}.json`,
  );
  let prefix = null;
  if (existsSync(cfg)) prefix = JSON.parse(readFileSync(cfg, "utf8"))[appName]?.winePrefix ?? null;
  if (!prefix) {
    const def = join(home, "Games", "Heroic", "Prefixes");
    if (existsSync(def)) {
      const dirs = readdirSync(def).filter((d) => existsSync(join(def, d, "drive_c")));
      prefix = dirs.length ? join(def, dirs[0]) : null; // ponytail: first prefix; fine for one Epic game
    }
  }
  if (!prefix) return null;
  const users = join(prefix, "drive_c", "users");
  if (!existsSync(users)) return null;
  const user = readdirSync(users).find(
    (u) => u !== "Public" && existsSync(join(users, u, "Documents")),
  );
  return user ? join(users, user, "Documents") : null;
}

/** Where `{documents}` points for a given launcher/OS combination. */
export function documentsFor(kind, game) {
  if (kind === "steam-windows" || kind === "epic-windows")
    return join(process.env.USERPROFILE ?? home, "Documents");
  if (kind === "steam-linux") return game.steamAppId ? protonDocuments(game.steamAppId) : null;
  if (kind === "epic-linux") return game.epicAppName ? heroicDocuments(game.epicAppName) : null;
  return null;
}

const ORDER = win ? ["steam-windows", "epic-windows"] : ["steam-linux", "epic-linux"];

/** First platform whose placeholders resolve and whose file exists. */
export function resolveFilePath(file, game) {
  for (const platform of ORDER) {
    const template = file.paths[platform];
    if (!template) continue;
    const userdata = steamUserdata();
    const documents = documentsFor(platform, game);
    const path = template
      .replace("{steam_userdata}", userdata ?? "\u0000")
      .replace("{documents}", documents ?? "\u0000");
    if (path.includes("\u0000")) continue;
    if (existsSync(path)) return { platform, path };
  }
  return null;
}
