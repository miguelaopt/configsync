import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseVdf } from "./vdf.mjs";
import { steamLibraries } from "./paths.mjs";

const NOT_GAMES = /^(Proton|Steam Linux Runtime|Steamworks Common Redistributables)/;

export function scanSteam() {
  const out = [];
  for (const lib of steamLibraries()) {
    for (const f of readdirSync(lib).filter((n) => /^appmanifest_\d+\.acf$/.test(n))) {
      const app = parseVdf(readFileSync(join(lib, f), "utf8")).AppState;
      if (!app?.name || NOT_GAMES.test(app.name)) continue;
      out.push({
        source: "steam",
        appId: String(app.appid),
        name: app.name,
        installDir: join(lib, "common", app.installdir ?? ""),
      });
    }
  }
  return out;
}

export function scanEpic() {
  const out = [];
  if (process.platform === "win32") {
    const dir = join(
      process.env.ProgramData ?? "C:\\ProgramData",
      "Epic",
      "EpicGamesLauncher",
      "Data",
      "Manifests",
    );
    if (!existsSync(dir)) return out;
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".item"))) {
      const m = JSON.parse(readFileSync(join(dir, f), "utf8"));
      if (m.AppName && m.DisplayName)
        out.push({
          source: "epic",
          appId: m.AppName,
          name: m.DisplayName,
          installDir: m.InstallLocation ?? null,
        });
    }
    return out;
  }
  // Linux: Heroic keeps legendary's install list.
  const installed = join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "heroic",
    "legendaryConfig",
    "legendary",
    "installed.json",
  );
  if (!existsSync(installed)) return out;
  for (const g of Object.values(JSON.parse(readFileSync(installed, "utf8")))) {
    if (g?.app_name && g?.title)
      out.push({
        source: "epic",
        appId: g.app_name,
        name: g.title.replace(/[®™]/g, "").trim(),
        installDir: g.install_path ?? null,
      });
  }
  return out;
}
