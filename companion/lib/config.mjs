import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";

export function configPath() {
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"))
      : (process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"));
  return join(base, "csync", "config.json");
}

/** `{ url, token, device }` or null when never logged in. Device defaults to the hostname. */
export function loadConfig() {
  const p = configPath();
  if (!existsSync(p)) return null;
  let c;
  try {
    c = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    throw new Error(`${p} is not valid JSON. Delete it and run csync login again.`);
  }
  return { device: hostname(), ...c };
}

export function saveConfig(config) {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  chmodSync(p, 0o600); // `mode` only applies when the file is created
  return p;
}
