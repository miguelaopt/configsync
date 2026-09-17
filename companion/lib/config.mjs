import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";

export function configPath() {
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
      : (process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"));
  return join(base, "gsv", "config.json");
}

/** `{ url, token, device }` or null when never logged in. Device defaults to the hostname. */
export function loadConfig() {
  const p = configPath();
  if (!existsSync(p)) return null;
  const c = JSON.parse(readFileSync(p, "utf8"));
  return { device: hostname(), ...c };
}

export function saveConfig(config) {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  return p;
}
