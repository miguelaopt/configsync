# Auto-Switch / Background Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `csync watch` keeps every catalog game's config files equal to its Default preset while the game is closed (Pro); `csync launch` applies right before a game starts (Free).

**Architecture:** The server exposes the Default preset per catalog game with a content fingerprint (`/api/companion/sync`, Pro) and a single-game variant (`/api/companion/default`, Free). The CLI keeps `state.json` of what it applied, detects running processes from `processNames` in the catalog, and decides apply/wait/skip with one pure function. Applying reuses the existing `/apply` path with backups.

**Tech Stack:** Next.js 16 route handlers, Drizzle, Zod 4, Vitest; plain Node ≥ 20 ESM + `node --test` for the CLI.

**Spec:** `docs/superpowers/specs/2026-09-17-auto-switch-design.md`

## Global Constraints

- Never write a game file while its process runs; never write without `<file>.bak-<timestamp>`; never write a file the server didn't return.
- `csync launch` never blocks the game: apply errors are logged, the command still runs.
- `/api/companion/sync` is Pro: Free gets **403** with `Auto-switch is a Pro feature. Upgrade at <APP_URL>/pricing.`
- Active preset = the game's Default (`presets.isDefault`). No new tables.
- Change detection = `version` fingerprint (first 16 hex of sha256 of the preset document), never timestamps.
- CLI stays dependency-free, ESM `.mjs`, Node ≥ 20. Log one line per action; never log the token.
- `pnpm check` + `node --test "companion/test/**/*.test.mjs"` before every commit; attribution line from the session reminder on commits.
- Branch: `feat/auto-switch` (off `main`).

---

## File map

| Path                                                                                                           | Responsibility                                                                        |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `lib/catalog/schema.ts`, `catalog/*.json`                                                                      | `processNames` per game                                                               |
| `lib/data/catalog.ts`                                                                                          | `listSyncTargets(userId)`, `defaultPresetFor(userId, catalogId)`, `presetFingerprint` |
| `lib/api/companion.ts`                                                                                         | `forbidden` → 403                                                                     |
| `app/api/companion/sync/route.ts`                                                                              | Pro poll                                                                              |
| `app/api/companion/default/route.ts`                                                                           | Free single-game Default                                                              |
| `companion/lib/apply.mjs`                                                                                      | `applyPreset(config, game, presetSlug, { dryRun })` — shared by apply/watch/launch    |
| `companion/lib/state.mjs`                                                                                      | `loadState()`, `recordApplied(catalogId, { presetSlug, version })`                    |
| `companion/lib/procs.mjs`                                                                                      | `runningProcessNames()`, `parseTasklist()`, `isRunning(game, names)`                  |
| `companion/lib/sync.mjs`                                                                                       | `decide({ remote, applied, running })`                                                |
| `companion/lib/autostart.mjs`                                                                                  | `install()` / `uninstall()` per OS                                                    |
| `companion/bin/csync.mjs`                                                                                      | `watch`, `launch`, `games` hint, HELP                                                 |
| `companion/test/{sync,procs}.test.mjs`                                                                         | Unit tests                                                                            |
| `tests/catalog.test.ts`                                                                                        | fingerprint stability                                                                 |
| `components/settings-page/companion-card.tsx`, `lib/billing/public.ts`, `components/presets/preset-header.tsx` | Web copy                                                                              |
| `docs/companion.md`, `docs/catalog.md`                                                                         | Docs                                                                                  |

---

## Task 1: Server — `processNames`, fingerprint, `/default`, `/sync`, 403

**Files:**

- Modify: `lib/catalog/schema.ts`, `lib/catalog/index.ts` (`publicCatalog`), `catalog/cs2.json`, `catalog/rocket-league.json`, `lib/data/catalog.ts`, `lib/api/companion.ts`, `tests/catalog.test.ts`
- Create: `app/api/companion/sync/route.ts`, `app/api/companion/default/route.ts`

**Interfaces:**

- Produces:
  - `CatalogGame.processNames: string[]`; `PublicCatalogEntry.processNames: string[]`.
  - `presetFingerprint(doc: PresetDoc): string` — 16 hex chars; pure, in `lib/import-export/fingerprint.ts` (no `server-only`, so tests import it).
  - `type SyncTarget = { catalogId: string; gameSlug: string; presetSlug: string; presetName: string; version: string }`.
  - `listSyncTargets(userId): Promise<SyncTarget[]>`; `defaultPresetFor(userId, catalogId): Promise<SyncTarget | null>`.
  - HTTP: `GET /api/companion/sync` → `{ games: SyncTarget[] }` (Pro); `GET /api/companion/default?game=<catalogId>` → `SyncTarget` or 404.

- [ ] **Step 1: Failing test** — append to `tests/catalog.test.ts`:

```ts
import { presetFingerprint } from "@/lib/import-export/fingerprint";

describe("presetFingerprint", () => {
  const base = CATALOG[0]!.presets[0]!;
  it("is 16 hex chars, stable across key order, and changes with a value", () => {
    const a = presetFingerprint(base);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    const reordered = JSON.parse(JSON.stringify({ ...base, categories: base.categories }));
    expect(presetFingerprint(reordered)).toBe(a);
    const changed = structuredClone(base);
    changed.categories[0]!.settings[0]!.value = "something-else";
    expect(presetFingerprint(changed)).not.toBe(a);
  });
  it("every catalog game declares processNames", () => {
    for (const g of CATALOG) expect(g.processNames.length).toBeGreaterThan(0);
  });
});
```

Run `pnpm vitest run tests/catalog.test.ts` → FAIL.

- [ ] **Step 2: `lib/import-export/fingerprint.ts`**

```ts
import { createHash } from "node:crypto";
import type { PresetDoc } from "./schema";

/** Sorts object keys so semantically equal documents hash equal. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  return v;
}

/** Short content hash of a preset; changes when any value, setting or category changes. */
export function presetFingerprint(doc: PresetDoc): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(doc)))
    .digest("hex")
    .slice(0, 16);
}
```

- [ ] **Step 3: Catalog `processNames`** — `lib/catalog/schema.ts` in `catalogGameSchema`: `processNames: z.array(z.string().min(1)).default([]),`. `catalog/cs2.json` top level: `"processNames": ["cs2", "cs2.exe"],`; `catalog/rocket-league.json`: `"processNames": ["RocketLeague.exe"],`. `lib/catalog/index.ts`: `catalogToGameDoc` destructures `processNames: _p` out (it must not reach the GameDoc); `publicCatalog()` adds `processNames: g.processNames`.

Run the test → PASS. `pnpm typecheck` → fix any spread type errors.

- [ ] **Step 4: Data** — append to `lib/data/catalog.ts` (add `presetFingerprint` and `desc` imports; `schema.presets`):

```ts
export type SyncTarget = {
  catalogId: string;
  gameSlug: string;
  presetSlug: string;
  presetName: string;
  version: string;
};

/** The Default preset of one catalog game, with a content fingerprint; null when none. */
export async function defaultPresetFor(
  userId: string,
  catalogId: string,
): Promise<SyncTarget | null> {
  const game = await findGameByCatalogId(userId, catalogId);
  if (!game) return null;
  const row = await db.query.presets.findFirst({
    where: and(
      eq(schema.presets.gameId, game.id),
      eq(schema.presets.isDefault, true),
      eq(schema.presets.isArchived, false),
    ),
    columns: { id: true, slug: true, name: true },
  });
  if (!row) return null;
  const full = await getPresetFull(userId, row.id);
  return {
    catalogId,
    gameSlug: game.slug,
    presetSlug: row.slug,
    presetName: row.name,
    version: presetFingerprint(toPresetDoc(full)),
  };
}

/** Every catalog game the user owns that has a Default preset. */
export async function listSyncTargets(userId: string): Promise<SyncTarget[]> {
  const ids = await listOwnedCatalogIds(userId);
  const targets = await Promise.all(ids.map((id) => defaultPresetFor(userId, id)));
  // ponytail: one full-preset load per catalog game every poll; cache by max(updated_at) if it ever matters.
  return targets.filter((t): t is SyncTarget => t !== null);
}
```

- [ ] **Step 5: 403 mapping** — `lib/api/companion.ts`: replace the `AppError` branch with

```ts
if (error instanceof AppError)
  return NextResponse.json(
    { error: error.message },
    { status: error.code === "forbidden" ? 403 : 404 },
  );
```

- [ ] **Step 6: Routes**

`app/api/companion/sync/route.ts`:

```ts
import { companionRoute } from "@/lib/api/companion";
import { getPlan } from "@/lib/billing/plan";
import { listSyncTargets } from "@/lib/data/catalog";
import { AppError } from "@/lib/data/errors";
import { env } from "@/lib/env";

/** What `csync watch` polls: the Default preset of every owned catalog game. Pro only. */
export const GET = companionRoute(null, async (_i, userId) => {
  if ((await getPlan(userId)).plan !== "pro")
    throw new AppError(
      `Auto-switch is a Pro feature. Upgrade at ${env.NEXT_PUBLIC_APP_URL}/pricing.`,
      "forbidden",
    );
  return { games: await listSyncTargets(userId) };
});
```

`app/api/companion/default/route.ts`:

```ts
import { companionRoute } from "@/lib/api/companion";
import { defaultPresetFor } from "@/lib/data/catalog";
import { AppError } from "@/lib/data/errors";
import { catalogIdSchema } from "@/lib/validation";

/** The Default preset of one catalog game — for `csync launch`. Free. */
export const GET = companionRoute(null, async (_i, userId, req) => {
  const game = catalogIdSchema.safeParse(new URL(req.url).searchParams.get("game"));
  if (!game.success) throw new AppError("Pass ?game=<catalog id>.", "invalid");
  const target = await defaultPresetFor(userId, game.data);
  if (!target)
    throw new AppError(`You don't have a Default preset for ${game.data} yet.`, "not_found");
  return target;
});
```

(`invalid` still maps to 404 — acceptable; the CLI always sends a valid id.)

- [ ] **Step 7: Verify** — `pnpm check` PASS. With the dev server and the `csync_` token in the scratchpad:

```bash
T=$(cat "$S/token.txt"); U=http://localhost:3000
curl -s -H "Authorization: Bearer $T" "$U/api/companion/default?game=cs2"          # → SyncTarget JSON
curl -s -w " [%{http_code}]" -H "Authorization: Bearer $T" "$U/api/companion/sync"  # → games [200] (demo is Pro via sandbox sub)
```

For the 403, use a fresh Free account rather than touching the demo user's Paddle row: sign up
`free-check@example.com`, create a companion token in Settings, call `/sync` with it → `[403]`
and the sentence.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(companion): sync and default endpoints with preset fingerprints; catalog processNames"`

---

## Task 2: Companion library — apply, state, procs, decide (+ tests)

**Files:**

- Create: `companion/lib/apply.mjs`, `companion/lib/state.mjs`, `companion/lib/procs.mjs`, `companion/lib/sync.mjs`, `companion/test/sync.test.mjs`, `companion/test/procs.test.mjs`
- Modify: `companion/bin/csync.mjs` (`apply` uses `applyPreset`; `readFiles` moves to `apply.mjs`)

**Interfaces:**

- Produces:
  - `readFiles(game, { log }) → { files, found }` (moved; `log` optional, defaults to `console.log`).
  - `applyPreset(config, game, presetSlug, { dryRun = false, log = console.log }) → { changed, skipped, wrote: string[] }` — reads files, `POST /apply`, backs up + writes, prints per-key changes.
  - `loadState() → { applied: Record<string, { presetSlug, version, at }> }`; `recordApplied(catalogId, { presetSlug, version })`; `statePath()`.
  - `runningProcessNames() → Promise<Set<string>>` (lower-cased); `parseTasklist(csv: string) → string[]`; `isRunning(game, names: Set<string>) → boolean`.
  - `decide({ remote, applied, running }) → "apply" | "wait" | "skip"`.

- [ ] **Step 1: Failing tests**

`companion/test/sync.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { decide } from "../lib/sync.mjs";

const v1 = { presetSlug: "main", version: "aaaa" };
const v2 = { presetSlug: "main", version: "bbbb" };

test("skip when the vault has no Default or nothing changed", () => {
  assert.equal(decide({ remote: null, applied: v1, running: false }), "skip");
  assert.equal(decide({ remote: v1, applied: v1, running: false }), "skip");
  assert.equal(decide({ remote: v1, applied: v1, running: true }), "skip");
});
test("apply when changed and the game is closed", () => {
  assert.equal(decide({ remote: v2, applied: v1, running: false }), "apply");
  assert.equal(decide({ remote: v1, applied: null, running: false }), "apply");
  assert.equal(
    decide({ remote: { presetSlug: "other", version: "aaaa" }, applied: v1, running: false }),
    "apply",
  );
});
test("wait when changed but the game is running", () => {
  assert.equal(decide({ remote: v2, applied: v1, running: true }), "wait");
  assert.equal(decide({ remote: v1, applied: null, running: true }), "wait");
});
```

`companion/test/procs.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { isRunning, parseTasklist } from "../lib/procs.mjs";

test("parseTasklist reads the first CSV column", () => {
  const csv =
    '"cs2.exe","1234","Console","1","1,024 K"\r\n"explorer.exe","99","Console","1","10 K"\r\n';
  assert.deepEqual(parseTasklist(csv), ["cs2.exe", "explorer.exe"]);
});
test("isRunning matches any processName case-insensitively", () => {
  const game = { processNames: ["cs2", "cs2.exe"] };
  assert.equal(isRunning(game, new Set(["bash", "cs2"])), true);
  assert.equal(isRunning(game, new Set(["CS2.EXE".toLowerCase()])), true);
  assert.equal(isRunning(game, new Set(["steam"])), false);
  assert.equal(isRunning({ processNames: [] }, new Set(["cs2"])), false);
});
```

Run `node --test "companion/test/**/*.test.mjs"` → FAIL (modules missing).

- [ ] **Step 2: `companion/lib/sync.mjs`**

```js
/**
 * One decision per game per tick. `remote` is the vault's Default (`{ presetSlug, version }` or
 * null), `applied` what this machine last wrote, `running` whether the game's process is up.
 */
export function decide({ remote, applied, running }) {
  if (!remote) return "skip";
  if (applied && applied.presetSlug === remote.presetSlug && applied.version === remote.version)
    return "skip";
  return running ? "wait" : "apply";
}
```

- [ ] **Step 3: `companion/lib/procs.mjs`**

```js
import { readdirSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Windows `tasklist /fo csv /nh` → image names. */
export function parseTasklist(csv) {
  return csv
    .split(/\r?\n/)
    .filter((l) => l.startsWith('"'))
    .map((l) => l.slice(1, l.indexOf('",')));
}

/** Lower-cased executable names of every running process. */
export async function runningProcessNames() {
  const names = new Set();
  if (process.platform === "win32") {
    const { stdout } = await run("tasklist", ["/fo", "csv", "/nh"]);
    for (const n of parseTasklist(stdout)) names.add(n.toLowerCase());
    return names;
  }
  try {
    for (const pid of readdirSync("/proc").filter((d) => /^\d+$/.test(d))) {
      try {
        names.add(readFileSync(`/proc/${pid}/comm`, "utf8").trim().toLowerCase());
      } catch {
        // process exited between readdir and read
      }
    }
  } catch {
    const { stdout } = await run("ps", ["-eo", "comm="]); // macOS: no /proc
    for (const l of stdout.split("\n"))
      if (l.trim()) names.add(l.trim().split("/").pop().toLowerCase());
  }
  return names;
}

export function isRunning(game, names) {
  return (game.processNames ?? []).some((p) => names.has(p.toLowerCase()));
}
```

Note: `/proc/<pid>/comm` is truncated to 15 chars by the kernel — `cs2` and `RocketLeague.ex` fit? `RocketLeague.exe` is 16 chars → truncated to `RocketLeague.ex`. Handle: compare with `names.has(p) || names.has(p.slice(0, 15))` in `isRunning`. Add to the test: `isRunning({ processNames: ["RocketLeague.exe"] }, new Set(["rocketleague.ex"]))` → true.

- [ ] **Step 4: `companion/lib/state.mjs`**

```js
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
```

- [ ] **Step 5: `companion/lib/apply.mjs`** — move `readFiles` here and extract the apply body:

```js
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { api } from "./api.mjs";
import { resolveFilePath } from "./paths.mjs";
import { recordApplied } from "./state.mjs";

export function readFiles(game, { log = console.log } = {}) {
  const files = {};
  const found = [];
  for (const f of game.files) {
    const hit = resolveFilePath(f, game);
    if (!hit) {
      log(`  ${f.id}: not found on this machine`);
      continue;
    }
    files[f.id] = readFileSync(hit.path, "utf8");
    found.push({ id: f.id, path: hit.path });
    log(`  ${f.id}: ${hit.path}`);
  }
  return { files, found };
}

/**
 * Patch this machine's files with a preset. Backs each file up first; writes only what the
 * server returned; records the applied version when `version` is given.
 */
export async function applyPreset(
  config,
  game,
  presetSlug,
  { dryRun = false, log = console.log, version } = {},
) {
  const { files, found } = readFiles(game, { log });
  if (found.length === 0) throw new Error(`No ${game.name} config files found on this machine.`);
  const r = await api(config).post("/apply", { catalogId: game.id, presetSlug, files });
  for (const [id, keys] of Object.entries(r.changed))
    log(
      `${id}: ${Object.entries(keys)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
  for (const s of r.skipped) log(`Skipped — ${s}`);
  if (dryRun) return { ...r, wrote: [] };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const wrote = [];
  for (const { id, path } of found) {
    if (!r.files[id]) continue;
    copyFileSync(path, `${path}.bak-${stamp}`);
    writeFileSync(path, r.files[id]);
    wrote.push(path);
    log(`Wrote ${path} (backup: ${path}.bak-${stamp})`);
  }
  if (version) recordApplied(game.id, { presetSlug, version });
  return { ...r, wrote };
}
```

`companion/bin/csync.mjs`: delete its `readFiles` and the body of `apply()`; import `{ applyPreset, readFiles }` from `../lib/apply.mjs`; `apply()` becomes:

```js
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
```

Remove the now-unused `copyFileSync, readFileSync, writeFileSync` and `resolveFilePath` imports from `csync.mjs` (keep what `games`/`importCmd` still use: `readFiles` from apply.mjs).

- [ ] **Step 6: Verify** — `node --test "companion/test/**/*.test.mjs"` PASS (6 tests); `pnpm lint` PASS; `pnpm csync apply cs2 cli-check --dry-run` prints the same key list as before and writes nothing.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "refactor(companion): shared applyPreset, state file, process detection and sync decision"`

---

## Task 3: `csync watch`, `csync launch`, autostart, `games` hint

**Files:**

- Create: `companion/lib/autostart.mjs`
- Modify: `companion/bin/csync.mjs`

**Interfaces:**

- Consumes: `applyPreset`, `readFiles`, `loadState`, `runningProcessNames`, `isRunning`, `decide`, `/sync`, `/default`.
- Produces: commands `watch [--interval <s>] [--once] [--install] [--uninstall]`, `launch <game> -- <cmd…>`; `autostart.install(nodePath, scriptPath)`, `autostart.uninstall()`.

- [ ] **Step 1: `companion/lib/autostart.mjs`**

```js
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

function unitPath() {
  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "systemd",
    "user",
    "csync-watch.service",
  );
}
function startupCmdPath() {
  return join(
    process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "csync-watch.cmd",
  );
}

/** Start `csync watch` with the user session. Returns a sentence describing what was done. */
export function install(nodePath, scriptPath) {
  if (process.platform === "linux") {
    const p = unitPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(
      p,
      `[Unit]\nDescription=ConfigSync companion — keeps game config files in sync\nAfter=network-online.target\n\n[Service]\nExecStart=${nodePath} ${scriptPath} watch\nRestart=on-failure\nRestartSec=30\n\n[Install]\nWantedBy=default.target\n`,
    );
    execFileSync("systemctl", ["--user", "daemon-reload"]);
    execFileSync("systemctl", ["--user", "enable", "--now", "csync-watch"]);
    return `Installed and started systemd user unit ${p}. Logs: journalctl --user -u csync-watch -f`;
  }
  if (process.platform === "win32") {
    const p = startupCmdPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `@echo off\r\nstart "" /min "${nodePath}" "${scriptPath}" watch\r\n`);
    return `Installed ${p}. It starts with Windows; run it once now or sign in again.`;
  }
  throw new Error("Autostart isn't supported on this OS yet. Run `csync watch` in a terminal.");
}

export function uninstall() {
  if (process.platform === "linux") {
    try {
      execFileSync("systemctl", ["--user", "disable", "--now", "csync-watch"], { stdio: "ignore" });
    } catch {
      // not installed
    }
    if (existsSync(unitPath())) unlinkSync(unitPath());
    return "Removed the csync-watch systemd user unit.";
  }
  if (process.platform === "win32") {
    if (existsSync(startupCmdPath())) unlinkSync(startupCmdPath());
    return "Removed csync-watch from the Startup folder.";
  }
  throw new Error("Autostart isn't supported on this OS yet.");
}
```

- [ ] **Step 2: Commands in `companion/bin/csync.mjs`** — imports: `import { spawn } from "node:child_process"; import { fileURLToPath } from "node:url"; import { applyPreset, readFiles } from "../lib/apply.mjs"; import { loadState } from "../lib/state.mjs"; import { isRunning, runningProcessNames } from "../lib/procs.mjs"; import { decide } from "../lib/sync.mjs"; import * as autostart from "../lib/autostart.mjs";`

HELP gains:

```
  csync watch [--interval 30] [--once]  keep every game's files equal to its Default preset (Pro); --install/--uninstall autostart
  csync launch <game> -- <command…>     apply the game's Default preset, then run the command (Steam launch options)
```

`launch` needs raw args after `--`: compute `const dashdash = process.argv.indexOf("--"); const tail = dashdash >= 0 ? process.argv.slice(dashdash + 1) : [];` before `rest` is filtered, and exclude everything from `--` on from `rest`/`args`.

```js
const ts = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`${ts()} ${m}`);

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
  do {
    await tick(c, catalog, state, waiting);
    if (flag("once")) break;
    await new Promise((r) => setTimeout(r, interval));
  } while (true);
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
  child.on("exit", (code) => process.exit(code ?? 0));
}
```

`games()` prints after `readFiles(g)`: `if (found.length) console.log(` Steam launch options: csync launch ${g.id} -- %command%`);` (capture `const { found } = readFiles(g)`).

`const commands = { login, scan, games, import: importCmd, apply, watch, launch };`. `catalogGame` already exits on unknown ids — inside `launch`'s try it would exit before launching; change `catalogGame` to `throw new Error(...)` instead of `process.exit(2)` and let the top-level `.catch` print and exit 1 (keeps `launch` launching).

- [ ] **Step 3: Verify manually** (dev server up, demo account Pro via the sandbox subscription, CS2 closed):

```bash
pnpm csync watch --once                 # first run: "applied "<Default>" to Counter-Strike 2" (and Rocket League if it has a Default)
pnpm csync watch --once                 # second run: silent (skip)
# change a value in the CS2 Default preset in the web app, then:
pnpm csync watch --once                 # applied again; setting changed in the real file
cat ~/.config/csync/state.json
pnpm csync launch cs2 -- echo hi        # "csync: applied …" then "hi"
```

Open CS2 (or fake it: `bash -c 'exec -a cs2 sleep 60' &`), change the preset, `pnpm csync watch --once` → `waiting: Counter-Strike 2 is running…`; kill the sleep → next `--once` applies. Free account token → `pnpm csync watch --once` prints the Pro sentence, exit 2. `pnpm csync watch --install` → `systemctl --user status csync-watch` active; `--uninstall` removes. Restore real game files from the `.bak-*` created today and delete those backups.

- [ ] **Step 4: Checks + commit** — `pnpm check`, `node --test …`, `pnpm exec prettier --check .` PASS. `git add -A && git commit -m "feat(companion): csync watch (background sync), csync launch (launch wrapper), autostart install"`

---

## Task 4: Web copy, docs, PR

**Files:**

- Modify: `lib/billing/public.ts` (FEATURES.pro), `components/settings-page/companion-card.tsx` (snippet incl. the `\ngsv` leftover), `components/presets/preset-header.tsx` (Default badge tooltip), `docs/companion.md`, `docs/catalog.md`, `README.md` (Companion section), `e2e/vault.spec.ts` if any copy assertion changes

- [ ] **Step 1: Copy**

- `lib/billing/public.ts` pro feature: `"Auto-switch: your PC keeps every game's files equal to its Default preset (csync watch)"` (no "coming soon").
- `companion-card.tsx` snippet: `git clone ${SITE.repoUrl} && cd configsync/companion && npm i -g .\ncsync login ${appUrl}\ncsync scan --push\ncsync import cs2\ncsync watch --install   # Pro: background sync` and below the docs line: `<p className="mt-1 text-ink-3">Steam launch options: <code className="font-mono text-xs">csync launch cs2 -- %command%</code> applies the Default preset right before the game starts.</p>`.
- `preset-header.tsx`: wrap the Default badge in `<Tooltip content="Applied by csync watch on your PCs">…</Tooltip>` only when `game.catalogId` (read `components/ui/tooltip.tsx` for the exact prop name — `content` or children pattern).

- [ ] **Step 2: Docs** — `docs/companion.md`: new rows for `csync watch` and `csync launch` in the commands table; a "Background sync" section (what it does, why it never writes while a game runs, `state.json`, autostart per OS, Pro); the launch-options recipe for Steam and Heroic (Advanced → Wrapper: `csync launch rocket-league --`). `docs/catalog.md`: `processNames` field in the layout and rules ("executable names as a process list shows them; Linux truncates to 15 chars, handled"). `README.md` Companion snippet gains `csync watch --install`.

- [ ] **Step 3: Verify** — `pnpm check`, prettier, `node --test`, `pnpm test:e2e` PASS.

- [ ] **Step 4: Commit + PR**

```bash
git add -A && git commit -m "docs: background sync and launch wrapper; pricing and companion card copy"
git push -u origin feat/auto-switch
gh pr create --base main --title "Auto-switch: csync watch background sync and csync launch wrapper" --body …
```

---

## Self-review notes

- Spec A → Task 1 Step 3; B → Task 1; C (`sync.mjs`, `procs.mjs`, state, `apply.mjs`, `watch`, `launch`, autostart) → Tasks 2–3; D → Task 4; testing → each task's verify step.
- Names: `applyPreset`, `readFiles` (2, 3); `loadState`, `recordApplied` (2, 3); `runningProcessNames`, `isRunning`, `parseTasklist` (2, 3); `decide` (2, 3); `SyncTarget`, `listSyncTargets`, `defaultPresetFor`, `presetFingerprint` (1); `autostart.install/uninstall` (3).
- Deliberate simplifications (`ponytail:`): one full-preset load per catalog game per poll; `/proc/comm` 15-char truncation handled by prefix compare; `launch` fetches the Default even for Free users (that is the intended Free path).
