#!/usr/bin/env node
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { api } from "../lib/api.mjs";
import { loadConfig, saveConfig } from "../lib/config.mjs";
import { resolveFilePath } from "../lib/paths.mjs";
import { scanEpic, scanSteam } from "../lib/scan.mjs";

const HELP = `gsv — GameSettings Vault companion

  gsv login <url>                       pair this machine with your vault (paste a token from Settings → Companion)
  gsv scan [--push]                     list installed Steam/Epic games; --push sends them to the vault
  gsv import <game> [--name "…"]        read the game's config files into a new preset (game: cs2, rocket-league…)
  gsv apply <game> <preset> [--dry-run] write a preset into the game's config files (backs up first)
  gsv games                             list catalog games and whether their files were found here

Close the game before import/apply. Steam Cloud may restore old files for some games.`;

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const args = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1] === "--name"));

function need() {
  const c = loadConfig();
  if (!c) {
    console.error("Not logged in. Run: gsv login <url>");
    process.exit(2);
  }
  return c;
}

/** Interactive prompt on a terminal; piped stdin (`echo $TOKEN | gsv login …`) is read to EOF. */
async function askToken(url) {
  if (!stdin.isTTY) {
    let s = "";
    for await (const chunk of stdin) s += chunk;
    return s.trim();
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const token = (await rl.question(`Token from ${url}/settings#companion: `)).trim();
  rl.close();
  return token;
}

async function login() {
  const url = args[0];
  if (!url) return console.error("Usage: gsv login <url>");
  const token = await askToken(url);
  if (!token) return console.error("No token given.");
  const me = await api({ url, token }).get("/me");
  const path = saveConfig({ url, token });
  console.log(`Logged in as ${me.user.email}. Saved to ${path}`);
}

async function scan() {
  const games = [...scanSteam(), ...scanEpic()].sort((a, b) => a.name.localeCompare(b.name));
  for (const g of games) console.log(`${g.source.padEnd(5)} ${g.appId.padEnd(10)} ${g.name}`);
  console.log(`\n${games.length} games found.`);
  if (!flag("push")) return console.log("Add --push to send this list to your vault.");
  const c = need();
  const r = await api(c).put("/devices", { device: c.device, games });
  console.log(`Sent ${r.stored} games as "${c.device}".`);
}

async function catalogGame(c, id) {
  const { games } = await api(c).get("/catalog");
  const g = games.find((x) => x.id === id);
  if (!g) {
    console.error(`Unknown game "${id ?? ""}". Known: ${games.map((x) => x.id).join(", ")}`);
    process.exit(2);
  }
  return g;
}

function readFiles(g) {
  const files = {};
  const found = [];
  for (const f of g.files) {
    const hit = resolveFilePath(f, g);
    if (!hit) {
      console.log(`  ${f.id}: not found on this machine`);
      continue;
    }
    files[f.id] = readFileSync(hit.path, "utf8");
    found.push({ id: f.id, path: hit.path });
    console.log(`  ${f.id}: ${hit.path}`);
  }
  return { files, found };
}

async function games() {
  const c = need();
  const { games } = await api(c).get("/catalog");
  for (const g of games) {
    console.log(`${g.id} — ${g.name}`);
    readFiles(g);
  }
}

async function importCmd() {
  const c = need();
  const g = await catalogGame(c, args[0]);
  console.log(`Reading ${g.name} files:`);
  const { files } = readFiles(g);
  if (Object.keys(files).length === 0) {
    console.error("No config files found. Is the game installed and has it been run once?");
    process.exit(1);
  }
  const r = await api(c).post("/import", {
    catalogId: g.id,
    device: c.device,
    files,
    name: opt("name"),
  });
  console.log(`\nCreated preset: ${c.url}${r.url}`);
  if (r.missingFiles.length)
    console.log(`Files not found (defaults kept): ${r.missingFiles.join(", ")}`);
  if (r.unmappedSettings.length)
    console.log(
      `${r.unmappedSettings.length} settings aren't stored in files — enter them by hand (e.g. ${r.unmappedSettings[0]}).`,
    );
  for (const w of r.warnings) console.log(`Warning: ${w}`);
}

async function apply() {
  const c = need();
  const [gameId, presetSlug] = args;
  if (!presetSlug) return console.error("Usage: gsv apply <game> <preset-slug> [--dry-run]");
  const g = await catalogGame(c, gameId);
  console.log(`Reading current ${g.name} files:`);
  const { files, found } = readFiles(g);
  const r = await api(c).post("/apply", { catalogId: g.id, presetSlug, files });
  for (const [id, keys] of Object.entries(r.changed))
    console.log(
      `\n${id}: ${Object.entries(keys)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  for (const s of r.skipped) console.log(`Skipped — ${s}`);
  if (flag("dry-run")) return console.log("\nDry run: nothing written.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const { id, path } of found) {
    if (!r.files[id]) continue;
    copyFileSync(path, `${path}.bak-${stamp}`);
    writeFileSync(path, r.files[id]);
    console.log(`Wrote ${path} (backup: ${path}.bak-${stamp})`);
  }
  console.log("\nDone. If the game was open, close it and apply again.");
}

const commands = { login, scan, games, import: importCmd, apply };
if (!cmd || !commands[cmd]) {
  console.log(HELP);
  process.exit(cmd ? 2 : 0);
}
commands[cmd]().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
