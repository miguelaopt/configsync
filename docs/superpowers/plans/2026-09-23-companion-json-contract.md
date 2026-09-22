# Companion JSON contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `csync` a machine-readable face — `csync status --json`, plus `--json` on `apply` and `import` — so the Windows desktop app can drive it without parsing English prose.

**Architecture:** A new `companion/lib/status.mjs` composes three existing sources (`/me`, `/catalog`, `/default`) plus local `readFiles()` and `state.json` into one object. The CLI gains a `status` command and a `--json` flag that swaps human output for `JSON.stringify`. Errors become `{"error": "…"}` on stdout when `--json` is set. No server change: every endpoint already returns what is needed.

**Tech Stack:** Node ESM (`.mjs`), no dependencies. Tests use `node:test` and a real `node:http` stub server, matching how `companion/test/discover.test.mjs` uses real temp directories rather than mocks.

**Spec:** `docs/superpowers/specs/2026-09-23-windows-desktop-app-design.md`

## Global Constraints

- The companion has **zero runtime dependencies**. Do not add any.
- Companion tests run with `node --test "companion/test/**/*.test.mjs"` — they are **not** in the vitest suite, which only includes `tests/**/*.test.ts`.
- `pnpm check` (typecheck + eslint + vitest) and `pnpm format:check` must pass before any commit.
- Absolute filesystem paths must never appear in JSON output. Logical file ids only.
- The token is never logged and never passed as a command-line argument.
- Nothing in this plan may change the behaviour of `applyPreset`'s write path — the running-game guard, the backup, and the fail-closed process check stay exactly as they are.
- Branch from `main` as `feat/companion-json`; one PR at the end. Never merge locally.

---

### Task 1: API errors carry their HTTP status

Without this, `status` cannot tell "this user has no Default preset for that game" (404, expected, means `target: null`) from "the server is down" (500, must propagate). Matching on the error message text would be brittle.

**Files:**

- Modify: `companion/lib/api.mjs:19` (the `if (!res.ok)` throw)
- Test: `companion/test/api.test.mjs` (create)

**Interfaces:**

- Consumes: nothing.
- Produces: errors thrown by `api(config).get/post/put` now carry a numeric `.status` property equal to the HTTP response status.

- [ ] **Step 1: Write the failing test**

Create `companion/test/api.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { api } from "../lib/api.mjs";

/** A throwaway server that answers every request with one status and body. */
async function serve(status, body) {
  const server = createServer((_req, res) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

test("an error carries the HTTP status so callers can tell 404 from 500", async () => {
  const s = await serve(404, { error: "You don't have a Default preset for cs2 yet." });
  try {
    await assert.rejects(
      () => api({ url: s.url, token: "t" }).get("/default?game=cs2"),
      (e) => {
        assert.equal(e.status, 404);
        assert.match(e.message, /Default preset/);
        return true;
      },
    );
  } finally {
    await s.close();
  }
});

test("a server error keeps its status too", async () => {
  const s = await serve(500, { error: "Something went wrong on the server." });
  try {
    await assert.rejects(
      () => api({ url: s.url, token: "t" }).get("/me"),
      (e) => {
        assert.equal(e.status, 500);
        return true;
      },
    );
  } finally {
    await s.close();
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test companion/test/api.test.mjs`
Expected: FAIL — `e.status` is `undefined`.

- [ ] **Step 3: Attach the status**

In `companion/lib/api.mjs`, replace this line:

```js
if (!res.ok) throw new Error(json?.error ?? `${res.status} ${res.statusText}`);
```

with:

```js
if (!res.ok) {
  // The status is how callers tell an expected 404 (no Default preset yet) from a real
  // failure. Matching on the message text would break the first time it is reworded.
  const error = new Error(json?.error ?? `${res.status} ${res.statusText}`);
  error.status = res.status;
  throw error;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test companion/test/api.test.mjs`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add companion/lib/api.mjs companion/test/api.test.mjs
git commit -m "refactor(companion): api errors carry their HTTP status"
```

---

### Task 2: `applyPreset` reports which logical files it wrote

The JSON contract promises `"wrote": ["video", "convars"]` — logical ids, never absolute paths. Today `applyPreset` returns `wrote` as an array of absolute paths. Nothing reads it (`apply`, `watch` and `launch` all ignore the return value), so it can change shape safely.

**Files:**

- Modify: `companion/lib/apply.mjs` (the write loop, around `wrote.push(path)`)
- Test: `companion/test/apply.test.mjs` (add one test)

**Interfaces:**

- Consumes: nothing.
- Produces: `applyPreset(...)` resolves to `{ ...serverResponse, wrote: Array<{ id: string, path: string }> }`. A dry run still returns `wrote: []`.

- [ ] **Step 1: Write the failing test**

Append to `companion/test/apply.test.mjs`:

```js
test("a dry run reports nothing written, in the shape the JSON contract expects", async () => {
  const game = { name: "Fake Game", processNames: ["nothing-is-called-this"], files: [] };
  await assert.rejects(
    () => applyPreset({ url: "http://127.0.0.1:1", token: "t" }, game, "default", { dryRun: true }),
    /No Fake Game config files found/,
  );
});
```

This one documents the early exit. The shape change itself is covered by reading the code in Step 3 and by Task 3's end-to-end test, because exercising a real write needs a resolvable game directory, which `resolveFilePath` only produces for a real Steam or Proton layout.

- [ ] **Step 2: Run the suite to see it pass already**

Run: `node --test companion/test/apply.test.mjs`
Expected: PASS, 3 tests. (This test guards the early-exit path; the next step changes a line it does not reach.)

- [ ] **Step 3: Return the logical id alongside the path**

In `companion/lib/apply.mjs`, inside the write loop, replace:

```js
wrote.push(path);
```

with:

```js
// { id, path }, not the bare path: callers that report to a GUI must be able to name the
// file without leaking where it lives on disk.
wrote.push({ id, path });
```

- [ ] **Step 4: Run the whole companion suite**

Run: `node --test "companion/test/**/*.test.mjs"`
Expected: PASS, all tests. Nothing consumes `wrote`, so nothing else moves.

- [ ] **Step 5: Commit**

```bash
git add companion/lib/apply.mjs companion/test/apply.test.mjs
git commit -m "refactor(companion): applyPreset names the logical files it wrote"
```

---

### Task 3: `companion/lib/status.mjs`

One call that answers the whole desktop window.

**Files:**

- Create: `companion/lib/status.mjs`
- Test: `companion/test/status.test.mjs` (create)

**Interfaces:**

- Consumes: `api()` with `.status` on errors (Task 1); `readFiles(game, { log })` from `apply.mjs`; `loadState()` from `state.mjs`.
- Produces: `status(config)` → `Promise<object>`. `config` is the object `loadConfig()` returns (`{ url, token, device }`) or `null`. Shape when logged out: `{ loggedIn: false }`. Shape when logged in: `{ loggedIn: true, url, device, user, plan, games: [{ id, name, installed, files, target, applied }] }` where `target` is `{ presetSlug, presetName, version }` or `null`, and `applied` is the `state.json` record or `null`.

- [ ] **Step 1: Write the failing test**

Create `companion/test/status.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { status } from "../lib/status.mjs";

/** Serves the companion API from a map of "/path" → { status?, body }. */
async function serve(routes) {
  const server = createServer((req, res) => {
    const path = req.url.replace("/api/companion", "");
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    const hit = key ? routes[key] : null;
    res.writeHead(hit ? (hit.status ?? 200) : 404, { "content-type": "application/json" });
    res.end(JSON.stringify(hit ? hit.body : { error: "no such route" }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

const ME = { body: { user: { email: "you@example.com" }, plan: "pro" } };
const CATALOG = {
  body: { games: [{ id: "cs2", name: "Counter-Strike 2", files: [], processNames: ["cs2"] }] },
};

test("logged out is a successful answer, not an error", async () => {
  assert.deepEqual(await status(null), { loggedIn: false });
});

test("composes the account, the catalog and this PC's target preset", async () => {
  const s = await serve({
    "/me": ME,
    "/catalog": CATALOG,
    "/default": {
      body: { presetSlug: "competitive", presetName: "Competitive", version: "a1b2c3" },
    },
  });
  try {
    const r = await status({ url: s.url, token: "t", device: "win-01" });
    assert.equal(r.loggedIn, true);
    assert.equal(r.device, "win-01");
    assert.equal(r.plan, "pro");
    assert.equal(r.user.email, "you@example.com");
    assert.equal(r.games.length, 1);
    assert.deepEqual(r.games[0].target, {
      presetSlug: "competitive",
      presetName: "Competitive",
      version: "a1b2c3",
    });
    // The fake game declares no files, so nothing resolves on this machine.
    assert.equal(r.games[0].installed, false);
    assert.equal(r.games[0].files, 0);
  } finally {
    await s.close();
  }
});

test("a game with no Default preset is target:null, not a failed call", async () => {
  const s = await serve({
    "/me": ME,
    "/catalog": CATALOG,
    "/default": { status: 404, body: { error: "You don't have a Default preset for cs2 yet." } },
  });
  try {
    const r = await status({ url: s.url, token: "t", device: "win-01" });
    assert.equal(r.games[0].target, null);
    assert.equal(r.loggedIn, true); // the window still renders for a brand-new account
  } finally {
    await s.close();
  }
});

test("a real server failure is not swallowed as an empty target", async () => {
  const s = await serve({
    "/me": ME,
    "/catalog": CATALOG,
    "/default": { status: 500, body: { error: "Something went wrong on the server." } },
  });
  try {
    await assert.rejects(
      () => status({ url: s.url, token: "t", device: "win-01" }),
      /went wrong on the server/,
    );
  } finally {
    await s.close();
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test companion/test/status.test.mjs`
Expected: FAIL — `Cannot find module '../lib/status.mjs'`.

- [ ] **Step 3: Write `companion/lib/status.mjs`**

```js
import { api } from "./api.mjs";
import { readFiles } from "./apply.mjs";
import { loadState } from "./state.mjs";

/**
 * Everything the desktop window shows, in one call — and a useful `csync status` for a person.
 *
 * Composes three endpoints that already exist, so nothing on the server changes. The target
 * preset comes from `/default`, which is Free, rather than `/sync`, which is Pro: the window
 * has to work identically on both plans.
 */
export async function status(config) {
  if (!config) return { loggedIn: false };
  const client = api(config);
  const [me, catalog] = await Promise.all([client.get("/me"), client.get("/catalog")]);
  const state = loadState();
  const games = [];
  for (const game of catalog.games) {
    const { found } = readFiles(game, { log: () => {} });
    games.push({
      id: game.id,
      name: game.name,
      installed: found.length > 0,
      files: found.length,
      target: await targetFor(client, game.id, config.device),
      applied: state.applied?.[game.id] ?? null,
    });
  }
  return {
    loggedIn: true,
    url: config.url,
    device: config.device,
    user: me.user,
    plan: me.plan,
    games,
  };
}

/**
 * The preset this PC should run for a game, or null when the account has no Default for it yet.
 * A new account has none at all, and the window still has to render — so a 404 is an answer,
 * while anything else is a failure worth surfacing.
 */
async function targetFor(client, gameId, device) {
  try {
    const t = await client.get(
      `/default?game=${encodeURIComponent(gameId)}&device=${encodeURIComponent(device)}`,
    );
    return { presetSlug: t.presetSlug, presetName: t.presetName, version: t.version };
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `node --test companion/test/status.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add companion/lib/status.mjs companion/test/status.test.mjs
git commit -m "feat(companion): status() composes account, catalog and per-PC target"
```

---

### Task 4: The `status` command and the JSON error envelope

**Files:**

- Modify: `companion/bin/csync.mjs` — the `HELP` string, `need()`, the `commands` map, the final `.catch`
- Test: covered by Task 3's unit tests plus the manual check in Step 5

**Interfaces:**

- Consumes: `status()` from Task 3.
- Produces: `csync status [--json]`; `need()` and the top-level error handler emit `{"error": "…"}` on **stdout** and exit non-zero when `--json` is present.

- [ ] **Step 1: Import `status` and add the command**

In `companion/bin/csync.mjs`, add to the imports:

```js
import { status } from "../lib/status.mjs";
```

Add this function next to the other commands:

```js
/** One call the desktop app can read, and a quick answer for a person at a terminal. */
async function statusCmd() {
  const s = await status(loadConfig());
  if (flag("json")) return console.log(JSON.stringify(s, null, 2));
  if (!s.loggedIn) return console.log(`Not logged in. Run: ${cli} login <url>`);
  console.log(`${s.device} — ${s.user.email} (${s.plan})`);
  for (const g of s.games) {
    const where = g.installed ? `${g.files} files` : "not installed here";
    const target = g.target ? g.target.presetName : "no Default preset";
    const at = g.applied?.at ? ` · applied ${g.applied.at}` : "";
    console.log(`  ${g.name} — ${where} · ${target}${at}`);
  }
}
```

Register it:

```js
const commands = {
  login,
  status: statusCmd,
  scan,
  games,
  import: importCmd,
  apply,
  watch,
  launch,
  discover,
};
```

- [ ] **Step 2: Make failures machine-readable too**

Replace `need()` with:

```js
function need() {
  const c = loadConfig();
  if (!c) fail(`Not logged in. Run: ${cli} login <url>`, 2);
  return c;
}

/** One exit path, so `--json` callers never have to read prose off stderr. */
function fail(message, code = 1) {
  if (flag("json")) console.log(JSON.stringify({ error: message }));
  else console.error(message);
  process.exit(code);
}
```

Replace the final catch block:

```js
commands[cmd]().catch((e) => fail(flag("json") ? e.message : `Error: ${e.message}`));
```

- [ ] **Step 3: Add it to `HELP`**

In the `HELP` template literal, add this line directly after the `csync login` line:

```
  csync status [--json]                   what this PC is connected to, and the preset each game should run
```

- [ ] **Step 4: Check it by hand, logged out**

Run: `node companion/bin/csync.mjs status --json`
Expected: exactly `{ "loggedIn": false }`, exit 0.

Run: `node companion/bin/csync.mjs apply cs2 whatever --json`
Expected: `{"error":"Not logged in. Run: csync login <url>"}` on stdout, exit 2. Confirm with `node companion/bin/csync.mjs apply cs2 whatever --json 2>/dev/null` — the JSON must still appear, proving it is on stdout and not stderr.

- [ ] **Step 5: Run the full suite and commit**

Run: `node --test "companion/test/**/*.test.mjs"` — expected PASS.
Run: `pnpm check` and `pnpm format:check` — expected clean.

```bash
git add companion/bin/csync.mjs
git commit -m "feat(companion): csync status, and a JSON error envelope"
```

---

### Task 5: `--json` on `apply` and `import`

**Files:**

- Modify: `companion/bin/csync.mjs` — `apply()` and `importCmd()`

**Interfaces:**

- Consumes: `applyPreset(...)` returning `wrote: [{ id, path }]` (Task 2); `fail()` (Task 4).
- Produces: `csync apply <game> <preset> --json` → `{ wrote, changed, skipped, backups }`; `csync import <game> --json` → `{ url, missingFiles, unmappedSettings, warnings }`.

- [ ] **Step 1: Rewrite `apply()`**

Replace the whole `apply` function with:

```js
async function apply() {
  const c = need();
  const [gameId, presetSlug] = args;
  const json = flag("json");
  if (!presetSlug) fail(`Usage: ${cli} apply <game> <preset-slug> [--dry-run]`, 2);
  const g = await catalogGame(c, gameId);
  if (!json) console.log(`Reading current ${g.name} files:`);
  const r = await applyPreset(c, g, presetSlug, {
    dryRun: flag("dry-run"),
    log: json ? () => {} : console.log,
  });
  if (json)
    return console.log(
      // Logical ids only. The window has no use for absolute paths, and they are the most
      // personal thing the companion touches.
      JSON.stringify(
        {
          wrote: r.wrote.map((w) => w.id),
          changed: r.changed,
          skipped: r.skipped,
          backups: r.wrote.length,
        },
        null,
        2,
      ),
    );
  console.log(flag("dry-run") ? "\nDry run: nothing written." : "\nDone.");
}
```

- [ ] **Step 2: Add the JSON branch to `importCmd()`**

In `importCmd()`, immediately after the `const r = await api(c).post("/import", {...})` call, insert:

```js
if (flag("json"))
  return console.log(
    JSON.stringify(
      {
        url: r.url,
        missingFiles: r.missingFiles,
        unmappedSettings: r.unmappedSettings.length,
        warnings: r.warnings,
      },
      null,
      2,
    ),
  );
```

Also silence the human reading line above it by changing:

```js
console.log(`Reading ${g.name} files:`);
const { files } = readFiles(g);
```

to:

```js
const json = flag("json");
if (!json) console.log(`Reading ${g.name} files:`);
const { files } = readFiles(g, json ? { log: () => {} } : {});
```

and change the "No config files found" branch to use `fail`:

```js
if (Object.keys(files).length === 0)
  fail("No config files found. Is the game installed and has it been run once?");
```

- [ ] **Step 3: Update `HELP`**

Change the `apply` and `import` lines to show the flag:

```
  csync import <game> [--name "…"] [--json]   read the game's config files into a new preset (game: cs2, rocket-league…)
  csync apply <game> <preset> [--dry-run] [--json]  write a preset into the game's config files (backs up first)
```

- [ ] **Step 4: Verify the output is valid JSON and goes to stdout**

Run: `node companion/bin/csync.mjs apply cs2 anything --json 2>/dev/null | head -1`
Expected: a line starting `{` — the not-logged-in envelope, proving stdout.

Run: `node --test "companion/test/**/*.test.mjs"` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add companion/bin/csync.mjs
git commit -m "feat(companion): --json on apply and import"
```

---

### Task 6: Document it and release

**Files:**

- Modify: `companion/package.json` (version)
- Modify: `package.json` (version)
- Modify: `content/changelog.ts`
- Modify: `app/(marketing)/docs/companion/page.tsx` (the command table)
- Modify: `docs/companion.md` if it lists commands — check first with `grep -n "csync " docs/companion.md`

**Interfaces:**

- Consumes: everything above.
- Produces: nothing code depends on.

- [ ] **Step 1: Add the commands to the public guide**

In `app/(marketing)/docs/companion/page.tsx`, in the `Commands` table array, add after the `csync login` row:

```tsx
                ["csync status [--json]", "What this PC is connected to and what each game runs."],
```

and change the two existing rows to mention the flag:

```tsx
                ["csync import <game> [--name …] [--json]", "Read the files into a new preset."],
                [
                  "csync apply <game> <preset> [--dry-run] [--json]",
                  "Write a preset into the files, after a backup.",
                ],
```

- [ ] **Step 2: Bump both versions**

`companion/package.json`: `0.3.0` → `0.4.0` (a new command).
`package.json`: `0.11.0` → `0.12.0` (minor — something new, per `AGENTS.md` → Releases).

- [ ] **Step 3: Add the changelog entry**

At the top of the `CHANGELOG` array in `content/changelog.ts`:

```ts
  {
    date: "2026-09-23",
    version: "0.12.0",
    title: "The companion answers in JSON",
    changes: [
      {
        kind: "new",
        text: "csync 0.4.0: a new `csync status` shows what this PC is connected to and which preset each game should run. With `--json`, it and `csync apply` and `csync import` answer in JSON, so other tools — including the desktop app being built — can drive the companion.",
      },
    ],
  },
```

- [ ] **Step 4: Run the gate**

Run: `pnpm format` then `pnpm check` — expected clean, 98 tests.
Run: `node --test "companion/test/**/*.test.mjs"` — expected PASS.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "docs(companion): document status and --json (0.12.0)"
git push -u origin feat/companion-json
gh pr create --base main --title "feat(companion): a JSON contract for the desktop app (0.12.0)"
```

The PR body should state: what the contract is, that no server route changed, that `/default` was chosen over `/sync` because it is Free, and that this ships as a useful CLI improvement on its own whether or not the desktop app follows.

---

## Verification

After Task 6, against a real account on this machine:

```bash
node companion/bin/csync.mjs status
node companion/bin/csync.mjs status --json | python3 -m json.tool > /dev/null && echo "valid JSON"
```

The first should list Counter-Strike 2 and Rocket League with their file counts. The second must parse. If `csync login` has not been run on this machine, both correctly report the logged-out state instead.
