#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import { api } from "../lib/api.mjs";
import { loadConfig, saveConfig } from "../lib/config.mjs";
import { scanEpic, scanSteam } from "../lib/scan.mjs";
import { applyPreset, readFiles } from "../lib/apply.mjs";
import { loadState } from "../lib/state.mjs";
import { isRunning, runningProcessNames } from "../lib/procs.mjs";
import { decide } from "../lib/sync.mjs";
import * as autostart from "../lib/autostart.mjs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HELP = `csync — ConfigSync companion

  csync login <url>                       pair this machine with your vault (paste a token from Settings → Companion)
  csync scan [--push]                     list installed Steam/Epic games; --push sends them to the vault
  csync import <game> [--name "…"]        read the game's config files into a new preset (game: cs2, rocket-league…)
  csync apply <game> <preset> [--dry-run] write a preset into the game's config files (backs up first)
  csync games                             list catalog games and whether their files were found here
  csync watch [--interval 30] [--once]    keep every game's files equal to its Default preset (Pro); --install / --uninstall autostart
  csync launch <game> -- <command…>       apply the game's Default preset, then run the command (Steam launch options)

Close the game before import/apply. Steam Cloud may restore old files for some games.`;

const argv = process.argv.slice(2);
const dashdash = argv.indexOf("--");
/** Everything after `--` is the command `launch` runs, untouched. */
const tail = dashdash >= 0 ? argv.slice(dashdash + 1) : [];
const [cmd, ...rest] = dashdash >= 0 ? argv.slice(0, dashdash) : argv;
const flag = (name) => rest.includes(`--${name}`);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const args = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1] === "--name"));

function need() {
  const c = loadConfig();
  if (!c) {
    console.error("Not logged in. Run: csync login <url>");
    process.exit(2);
  }
  return c;
}

/** Interactive prompt on a terminal; piped stdin (`echo $TOKEN | csync login …`) is read to EOF. */
async function askToken(url) {
  if (!stdin.isTTY) {
    let s = "";
    for await (const chunk of stdin) s += chunk;
    return s.trim();
  }
  // Muted output: the token is a secret and should not land in the terminal scrollback.
  stdout.write(`Token from ${url}/settings#companion (input hidden): `);
  const muted = new Writable({ write: (_chunk, _enc, cb) => cb() });
  const rl = createInterface({ input: stdin, output: muted, terminal: true });
  const token = (await rl.question("")).trim();
  rl.close();
  stdout.write("\n");
  return token;
}

async function login() {
  const url = args[0];
  if (!url) return console.error("Usage: csync login <url>");
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
  if (!g)
    throw new Error(`Unknown game "${id ?? ""}". Known: ${games.map((x) => x.id).join(", ")}`);
  return g;
}

async function games() {
  const c = need();
  const { games } = await api(c).get("/catalog");
  for (const g of games) {
    console.log(`${g.id} — ${g.name}`);
    const { found } = readFiles(g);
    if (found.length) console.log(`  Steam launch options: csync launch ${g.id} -- %command%`);
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
  if (!presetSlug) return console.error("Usage: csync apply <game> <preset-slug> [--dry-run]");
  const g = await catalogGame(c, gameId);
  console.log(`Reading current ${g.name} files:`);
  await applyPreset(c, g, presetSlug, { dryRun: flag("dry-run") });
  console.log(
    flag("dry-run")
      ? "\nDry run: nothing written."
      : "\nDone. If the game was open, close it and apply again.",
  );
}

const ts = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`${ts()} ${m}`);

/** One pass over every catalog game: apply what changed, wait for running games, skip the rest. */
async function tick(c, catalog, state, waiting) {
  let sync;
  try {
    sync = await api(c).get("/sync");
  } catch (e) {
    if (/Pro feature/.test(e.message)) {
      console.error(e.message);
      process.exit(2);
    }
    log(`vault unreachable (${e.message}); retrying next tick`);
    return;
  }
  const running = await runningProcessNames();
  for (const target of sync.games) {
    const game = catalog.find((g) => g.id === target.catalogId);
    if (!game || game.files.length === 0) continue;
    const { found } = readFiles(game, { log: () => {} });
    if (found.length === 0) continue; // not installed here
    const remote = { presetSlug: target.presetSlug, version: target.version };
    const verdict = decide({
      remote,
      applied: state.applied[game.id] ?? null,
      running: isRunning(game, running),
    });
    if (verdict === "skip") continue;
    if (verdict === "wait") {
      if (!waiting.has(game.id))
        log(`waiting: ${game.name} is running; will apply "${target.presetName}" when it closes`);
      waiting.add(game.id);
      continue;
    }
    try {
      await applyPreset(c, game, target.presetSlug, { log: () => {}, version: target.version });
      state.applied[game.id] = remote;
      waiting.delete(game.id);
      log(`applied "${target.presetName}" to ${game.name}`);
    } catch (e) {
      log(`failed to apply to ${game.name}: ${e.message}`);
    }
  }
}

async function watch() {
  const me = fileURLToPath(import.meta.url);
  if (flag("install")) return console.log(autostart.install(process.execPath, me));
  if (flag("uninstall")) return console.log(autostart.uninstall());
  const c = need();
  const interval = Math.max(5, Number(opt("interval") ?? 30)) * 1000;
  const { games: catalog } = await api(c).get("/catalog");
  const state = loadState();
  const waiting = new Set();
  log(`watching ${catalog.length} catalog games every ${interval / 1000}s as "${c.device}"`);
  for (;;) {
    await tick(c, catalog, state, waiting);
    if (flag("once")) break;
    await new Promise((r) => setTimeout(r, interval));
  }
}

async function launch() {
  const c = need();
  const gameId = args[0];
  if (!gameId || tail.length === 0)
    return console.error("Usage: csync launch <game> -- <command…>");
  try {
    const g = await catalogGame(c, gameId);
    const target = await api(c).get(`/default?game=${encodeURIComponent(g.id)}`);
    await applyPreset(c, g, target.presetSlug, { log: () => {}, version: target.version });
    console.log(`csync: applied "${target.presetName}" to ${g.name}`);
  } catch (e) {
    console.error(`csync: could not apply (${e.message}); launching anyway`);
  }
  const child = spawn(tail[0], tail.slice(1), { stdio: "inherit" });
  child.on("error", (e) => {
    console.error(`csync: could not start ${tail[0]}: ${e.message}`);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

const commands = { login, scan, games, import: importCmd, apply, watch, launch };
if (!cmd || !commands[cmd]) {
  console.log(HELP);
  process.exit(cmd ? 2 : 0);
}
commands[cmd]().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
