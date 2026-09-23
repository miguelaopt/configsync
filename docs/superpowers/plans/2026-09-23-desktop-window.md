# Desktop window (phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tauri window on Windows that connects this PC, lists the catalog games with the preset each should run, and applies or imports a game with one button — every operation done by the bundled `csync.exe`.

**Architecture:** `desktop/src-tauri` is a stock Tauri 2 shell with two plugins (shell, opener) and no Rust logic of its own. The window is plain HTML/CSS/ES modules in `desktop/ui`, no bundler: `withGlobalTauri` exposes `window.__TAURI__.shell.Command`, which runs the `csync` sidecar with `--json` and reads the phase-1 contract. Everything that decides what to show lives in `desktop/ui/view.js` as pure functions tested with `node --test` on Linux; `main.js` only wires DOM and sidecar calls. Two small CLI changes come first, in their own PR, because the window cannot work without them.

**Tech Stack:** Tauri 2 (`tauri`, `tauri-plugin-shell`, `tauri-plugin-opener`), vanilla JS modules, `node:test`. Tauri CLI via `pnpm dlx @tauri-apps/cli@2`, not a dependency.

**Spec:** `docs/superpowers/specs/2026-09-23-windows-desktop-app-design.md` (sections B, "Errors and safety", phase 2)

## Global Constraints

- The companion has **zero runtime dependencies**. The window adds none to the web app either: no `@tauri-apps/*` entry in the root `package.json` or lockfile (the Docker image installs that file).
- The sidecar is invoked with an argument array. Capabilities pin every allowed argument list; nothing outside them can run.
- The token is written to the sidecar's **stdin**, never passed as an argument, never logged, never kept in a JS variable longer than the call.
- The window renders only values the CLI returned, with `textContent` / DOM APIs — **never `innerHTML`** (preset and game names are user data).
- The window has no filesystem access of its own: capabilities are `core:default`, `opener:default`, and the scoped shell entries — nothing else.
- Errors from the CLI are shown **verbatim**; the app invents no wording for them.
- `package.json` `version` is the only version: `tauri.conf.json` reads it by path. Cargo's `version` is a placeholder.
- Palette from `app/globals.css`: ground `#161826`, surface `#1c1f30`, line `#2a2d42`, ink `#e9e9ed`, ink-2 `#a9aac0`, ink-3 `#8f93ab`, accent `#9184d9`, accent-text `#b7a6ff`, good `#4ade80`, bad `#f2736a`. Dark only. Panel = surface + 1px line border + 14px radius.
- Nothing user-visible mentions the repository, open source or self-hosting.
- Out of scope here (phase 3): tray, autostart, the auto-switch toggle, `csync watch` ownership, the Startup `.cmd` migration. Closing the window quits the app. No placeholder for the toggle.
- `pnpm check` and `pnpm format:check` pass before every commit; companion tests `node --test "companion/test/**/*.test.mjs"`; window tests `node --test "desktop/test/**/*.test.js"`.
- **Two PRs.** PR A = Task 1 on `feat/companion-login-json`; it should be deployed before PR B is tried on Windows, because the Windows machine takes `csync-windows-x64.exe` from configsync.app. PR B = Tasks 2–5 on `feat/desktop-window`. Never merge locally.

## Review Focus

- **The vault is unreachable when the window opens** (offline, DNS failure): expect the error text and a Retry button, never a blank window or an endless "Loading…" — Task 3 tests `parseResult` on a failed run, Task 4 renders it.
- **A revoked or mistyped token**: expect the CLI's own message under the token field, the connect screen stays, and nothing is saved — Task 1 tests the 401 path of `login --json`.
- **The app cannot close the sidecar's stdin**: `csync login` must return after the first line instead of waiting for EOF, or Connect hangs forever — Task 1 tests it with stdin left open.
- **Apply pressed on a game that is running**: expect the CLI's refusal verbatim on that row, button enabled again, other rows unaffected — Task 3 tests that an `{error}` run with exit 1 comes back as `ok: false` with the message untouched.
- **Output that is not the contract** (an older `csync.exe`, a crash with a stack trace on stdout): expect a plain "reinstall" message, not a JSON parse exception — Task 3 tests non-JSON stdout for both exit codes.

---

### Task 1: `csync login --json`, first-line token, and manual apply records itself (PR A)

Three CLI gaps the window hits immediately:

1. `login` prints prose; the window needs `{ "email" }` or `{ "error" }`.
2. Piped stdin is read **to EOF**. Tauri's `Child` can `write()` but cannot close stdin, so Connect would hang. Read the first line instead; `echo $TOKEN | csync login …` still works.
3. `csync apply` never passes `version` to `applyPreset`, so `recordApplied` never runs and `status` says "never applied" for anything applied by hand — which is every apply the window does. When the slug applied is this PC's target, record the target's version.

**Files:**

- Modify: `companion/bin/csync.mjs` (`askToken`, `login`, `apply`)
- Modify: `companion/lib/status.mjs` (export `targetFor`)
- Create: `companion/test/login.test.mjs`
- Modify: `companion/package.json` (`0.4.0` → `0.5.0`), `package.json` (`0.12.1` → `0.12.2`), `content/changelog.ts`

**Interfaces:**

- Consumes: `api()` errors carry `.status` (phase 1); `status.mjs`'s private `targetFor(client, gameId, device)` → `{presetSlug, presetName, version} | null`.
- Produces for Task 4:
  - `csync login <url> --json` reads one line from stdin; prints `{"email": "…"}` exit 0, or `{"error": "…"}` exit ≠ 0.
  - `csync apply <game> <preset> --json` records `state.json` when `<preset>` is this PC's target, so the next `status` shows `applied`.
  - `export async function targetFor(client, gameId, device)` from `companion/lib/status.mjs`.

- [ ] **Step 1: Write the failing test**

Create `companion/test/login.test.mjs`. It runs the real CLI with stdin **left open**, which is exactly what the Tauri sidecar does.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = new URL("../bin/csync.mjs", import.meta.url).pathname;

/** /api/companion/me answers 200 for the token "good", 401 otherwise. */
async function serve() {
  const server = createServer((req, res) => {
    const ok = req.headers.authorization === "Bearer good";
    res.writeHead(ok ? 200 : 401, { "content-type": "application/json" });
    res.end(
      JSON.stringify(
        ok ? { user: { email: "you@example.com" }, plan: "free" } : { error: "Invalid token." },
      ),
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Writes one line and never closes stdin — the Tauri shell plugin cannot close it either. */
function login(url, line, home) {
  const child = spawn(process.execPath, [CLI, "login", url, "--json"], {
    env: { ...process.env, XDG_CONFIG_HOME: home, APPDATA: home },
  });
  let stdout = "";
  child.stdout.on("data", (d) => (stdout += d));
  child.stdin.write(line);
  const timer = setTimeout(() => child.kill(), 5000);
  return new Promise((resolve) =>
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout });
    }),
  );
}

test("login --json reads the first line and answers without waiting for EOF", async () => {
  const s = await serve();
  const home = mkdtempSync(join(tmpdir(), "csync-login-"));
  try {
    const r = await login(s.url, "  good  \n", home);
    assert.equal(r.code, 0);
    assert.deepEqual(JSON.parse(r.stdout), { email: "you@example.com" });
    assert.ok(existsSync(join(home, "csync", "config.json")));
  } finally {
    await s.close();
  }
});

test("a rejected token is an {error} and saves nothing", async () => {
  const s = await serve();
  const home = mkdtempSync(join(tmpdir(), "csync-login-"));
  try {
    const r = await login(s.url, "bad\n", home);
    assert.notEqual(r.code, 0);
    assert.deepEqual(JSON.parse(r.stdout), { error: "Invalid token." });
    assert.ok(!existsSync(join(home, "csync", "config.json")));
  } finally {
    await s.close();
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test companion/test/login.test.mjs`
Expected: FAIL — the first test is killed after 5 s (the CLI waits for EOF) and stdout is not JSON.

- [ ] **Step 3: Implement**

In `companion/bin/csync.mjs`, replace the non-TTY branch of `askToken`:

```js
if (!stdin.isTTY) {
  // First line only: the desktop app writes the token and a newline but cannot close stdin,
  // so reading to EOF would wait forever. `echo $TOKEN | csync login …` still works.
  const rl = createInterface({ input: stdin });
  for await (const line of rl) {
    rl.close();
    return line.trim();
  }
  return "";
}
```

Replace `login`:

```js
async function login() {
  const url = args[0];
  if (!url) fail("Usage: csync login <url>", 2);
  const token = await askToken(url);
  if (!token) fail("No token given.", 2);
  const me = await api({ url, token }).get("/me");
  const path = saveConfig({ url, token });
  if (flag("json")) return console.log(JSON.stringify({ email: me.user.email }, null, 2));
  console.log(`Logged in as ${me.user.email}. Saved to ${path}`);
}
```

(`me` is fetched before `saveConfig`, so a rejected token throws first and nothing is written; the top-level `catch` turns it into `{error}` under `--json`.) Update the `login` line of `HELP` to `csync login <url> [--json]`.

In `companion/lib/status.mjs`, change `async function targetFor(` to `export async function targetFor(`, and import it in `csync.mjs` next to `status`:

```js
import { status, targetFor } from "../lib/status.mjs";
```

In `apply()`, look up the target before writing and pass its version when the slugs match:

```js
const g = await catalogGame(c, gameId);
// Applying this PC's own target by hand counts as applied, so `status` (and the window) can
// say when. Any other preset is a one-off and leaves the record alone, as before.
const target = flag("dry-run") ? null : await targetFor(api(c), g.id, c.device);
if (!json) console.log(`Reading current ${g.name} files:`);
const r = await applyPreset(c, g, presetSlug, {
  dryRun: flag("dry-run"),
  log: json ? () => {} : console.log,
  version: target?.presetSlug === presetSlug ? target.version : undefined,
});
```

- [ ] **Step 4: Run the tests**

Run: `node --test "companion/test/**/*.test.mjs"`
Expected: all PASS, including both new tests in well under 5 s.

- [ ] **Step 5: Release bookkeeping**

`companion/package.json` `"version": "0.5.0"`; root `package.json` `"version": "0.12.2"` (if 0.12.1 has not been deployed yet when this merges, fold into its entry instead — AGENTS.md "same day share one bump"). Add at the top of `CHANGELOG` in `content/changelog.ts`:

```ts
  {
    date: "2026-09-23",
    version: "0.12.2",
    title: "Applying by hand is remembered",
    changes: [
      {
        kind: "fixed",
        text: "csync 0.5.0: applying this PC's own preset with `csync apply` is now recorded, so `csync status` says when it was applied instead of “never”.",
      },
      {
        kind: "improved",
        text: "`csync login` accepts `--json` and reads a piped token from the first line, so other tools can connect the companion without a terminal.",
      },
    ],
  },
```

- [ ] **Step 6: Gate and commit**

Run: `pnpm format:check && pnpm check`
Expected: PASS.

```bash
git checkout -b feat/companion-login-json
git add companion content/changelog.ts package.json
git commit -m "feat(companion): login --json, first-line token, manual apply is recorded (0.12.2)"
```

Push and open PR A. Merge and deploy only on the owner's word.

---

### Task 2: Tauri shell and sidecar wiring (PR B)

**Files:**

- Create: `desktop/package.json`, `desktop/README.md`
- Create: `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/build.rs`, `desktop/src-tauri/src/main.rs`
- Create: `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/capabilities/default.json`
- Create: `desktop/src-tauri/icons/*` (generated)
- Create: `scripts/desktop-sidecar.mjs`
- Modify: `package.json` (scripts), `.gitignore`, `.prettierignore`, `eslint.config.mjs`

**Interfaces:**

- Consumes: `public/csync-windows-x64.exe` / `public/csync-linux-x64` from `pnpm build:companion` (or downloaded from configsync.app).
- Produces for Tasks 3–4: a window labelled `main` loading `desktop/ui/index.html`; `window.__TAURI__.shell.Command.sidecar("binaries/csync", args)` allowed for exactly these argument lists: `["status","--json"]`, `["apply",<id>,<slug>,"--json"]`, `["import",<id>,"--json"]` (execute) and `["login","https://configsync.app","--json"]` (spawn + stdin write); `window.__TAURI__.opener.openUrl` for http(s).

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b feat/desktop-window
```

- [ ] **Step 2: Rust shell**

`desktop/src-tauri/Cargo.toml`:

```toml
[package]
name = "configsync-desktop"
# Placeholder: the app's version comes from the root package.json via tauri.conf.json.
version = "0.0.0"
edition = "2021"
publish = false

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-opener = "2"
```

`desktop/src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

`desktop/src-tauri/src/main.rs`:

```rust
// No console window behind the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The shell only: every filesystem and network operation is done by the csync sidecar.
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running ConfigSync");
}
```

- [ ] **Step 3: Config and capabilities**

`desktop/src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "ConfigSync",
  "version": "../../package.json",
  "identifier": "app.configsync.desktop",
  "build": { "frontendDist": "../ui" },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "label": "main",
        "title": "ConfigSync",
        "width": 440,
        "height": 640,
        "minWidth": 380,
        "minHeight": 480
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src ipc: http://ipc.localhost"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi"],
    "externalBin": ["binaries/csync"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.ico"]
  }
}
```

`desktop/src-tauri/capabilities/default.json` — the argument lists are the whole attack surface, so they are pinned; ids and slugs match `slugify` in `lib/utils/slug.ts` (`[a-z0-9-]`, ≤ 64, plus a `-N` suffix):

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "The main window: run the csync sidecar with the JSON contract, open links.",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        { "name": "binaries/csync", "sidecar": true, "args": ["status", "--json"] },
        {
          "name": "binaries/csync",
          "sidecar": true,
          "args": [
            "apply",
            { "validator": "^[a-z0-9-]{1,64}$" },
            { "validator": "^[a-z0-9-]{1,80}$" },
            "--json"
          ]
        },
        {
          "name": "binaries/csync",
          "sidecar": true,
          "args": ["import", { "validator": "^[a-z0-9-]{1,64}$" }, "--json"]
        }
      ]
    },
    {
      "identifier": "shell:allow-spawn",
      "allow": [
        {
          "name": "binaries/csync",
          "sidecar": true,
          "args": ["login", "https://configsync.app", "--json"]
        }
      ]
    },
    "shell:allow-stdin-write"
  ]
}
```

- [ ] **Step 4: Sidecar copy script, scripts, ignores**

Tauri looks for `binaries/csync-<target triple>[.exe]` next to `tauri.conf.json`. `scripts/desktop-sidecar.mjs`:

```js
/**
 * Puts the companion binaries where Tauri expects its sidecar: binaries/csync-<target triple>.
 * Copies whichever `pnpm build:companion` (or a download from configsync.app) left in public/.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const PAIRS = {
  "public/csync-windows-x64.exe": "csync-x86_64-pc-windows-msvc.exe",
  "public/csync-linux-x64": "csync-x86_64-unknown-linux-gnu",
};
const dir = "desktop/src-tauri/binaries";
mkdirSync(dir, { recursive: true });
const copied = Object.entries(PAIRS).filter(([from]) => existsSync(from));
if (copied.length === 0)
  throw new Error(
    "No companion binary in public/. Run pnpm build:companion, or download csync-windows-x64.exe from configsync.app into public/.",
  );
for (const [from, to] of copied) copyFileSync(from, `${dir}/${to}`);
console.log(copied.map(([, to]) => `${dir}/${to}`).join("\n"));
```

Root `package.json` scripts (the Tauri CLI runs through `dlx` so it never enters the web app's lockfile or Docker image):

```json
    "desktop:sidecar": "node scripts/desktop-sidecar.mjs",
    "desktop:dev": "node scripts/desktop-sidecar.mjs && cd desktop && pnpm dlx @tauri-apps/cli@2 dev",
    "desktop:build": "node scripts/desktop-sidecar.mjs && cd desktop && pnpm dlx @tauri-apps/cli@2 build",
```

`desktop/package.json` — only so `desktop/ui/*.js` are ES modules for both the WebView and `node --test`; nothing is ever installed here:

```json
{
  "private": true,
  "type": "module"
}
```

Append to `.gitignore` and `.prettierignore`:

```
desktop/src-tauri/target/
desktop/src-tauri/gen/
desktop/src-tauri/binaries/
```

Add to `globalIgnores([...])` in `eslint.config.mjs`: `"desktop/src-tauri/target/**"`, `"desktop/src-tauri/gen/**"`.

- [ ] **Step 5: Icons**

Run: `cd desktop && pnpm dlx @tauri-apps/cli@2 icon ../ConfigSync-brand-assets/configsync-app-icon-1024.png`
Expected: `desktop/src-tauri/icons/` holds `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico` (and others). Delete the `android/` and `ios/` subfolders if generated. Commit the rest.

- [ ] **Step 6: `desktop/README.md`**

```markdown
# ConfigSync desktop (Windows)

A Tauri window around the companion. It does nothing itself: every read, write and request is
`csync.exe --json`, shipped inside the app as a sidecar. See
`docs/superpowers/specs/2026-09-23-windows-desktop-app-design.md`.

## Run it on Windows

Once: install [Rust](https://rustup.rs) (default MSVC toolchain), Visual Studio Build Tools with
"Desktop development with C++", Node 22 and pnpm. WebView2 ships with Windows 11.

    curl.exe -fsSL https://configsync.app/csync-windows-x64.exe -o public/csync-windows-x64.exe
    pnpm desktop:dev

`pnpm desktop:build` produces the `.msi` under `desktop/src-tauri/target/release/bundle/msi/`.

## On Linux

Only for working on the window: install `rustup` and `webkit2gtk-4.1`, run
`pnpm build:companion`, then `pnpm desktop:dev`. The product has no Linux GUI.

## Tests

    node --test "desktop/test/**/*.test.js"
```

- [ ] **Step 7: Gate and commit**

Run: `pnpm format:check && pnpm check`
Expected: PASS. If `cargo` is available, also `cd desktop/src-tauri && cargo check` → compiles, and commit the generated `Cargo.lock`; otherwise the owner commits it after the first Windows build (Task 5).

```bash
git add desktop scripts/desktop-sidecar.mjs package.json .gitignore .prettierignore eslint.config.mjs
git commit -m "feat(desktop): Tauri shell with the csync sidecar and pinned capabilities"
```

---

### Task 3: What the window shows — pure view logic

**Files:**

- Create: `desktop/ui/view.js`
- Create: `desktop/test/view.test.js`

**Interfaces:**

- Consumes: the phase-1 JSON contract (`status`, `apply --json`, `import --json`) and Task 1's `login --json`.
- Produces for Task 4:
  - `SITE: string` — `"https://configsync.app"`
  - `parseResult({ code: number|null, stdout: string }): { ok: true, data } | { ok: false, error: string }`
  - `appliedLabel(applied: {at?: string}|null, now?: Date): string`
  - `gameView(game, now?: Date): { id, name, dim: boolean, files: string, preset: string, applied: string, canApply: boolean, canImport: boolean }`
  - `applyMessage(r: {wrote: string[], skipped: string[]}): string`
  - `importMessage(r: {unmappedSettings: number, missingFiles: string[], warnings: string[]}): string`

- [ ] **Step 1: Write the failing tests**

`desktop/test/view.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { appliedLabel, applyMessage, gameView, importMessage, parseResult } from "../ui/view.js";

test("parseResult passes a successful answer through", () => {
  assert.deepEqual(parseResult({ code: 0, stdout: '{ "email": "a@b.c" }\n' }), {
    ok: true,
    data: { email: "a@b.c" },
  });
});

test("parseResult keeps the CLI's error message verbatim", () => {
  const stdout = JSON.stringify({
    error: "Counter-Strike 2 is running. Close it and apply again.",
  });
  assert.deepEqual(parseResult({ code: 1, stdout }), {
    ok: false,
    error: "Counter-Strike 2 is running. Close it and apply again.",
  });
});

test("parseResult turns output that is not the contract into a plain message", () => {
  for (const code of [0, 1, null]) {
    const r = parseResult({ code, stdout: "TypeError: boom\n    at x (y.js:1:1)" });
    assert.equal(r.ok, false);
    assert.match(r.error, /reinstall/i);
  }
});

test("parseResult treats a non-zero exit with JSON but no error as a failure", () => {
  const r = parseResult({ code: 2, stdout: "{}" });
  assert.equal(r.ok, false);
});

test("appliedLabel says today, a date, or never", () => {
  const now = new Date(2026, 8, 23, 18, 0);
  assert.equal(appliedLabel(null, now), "never applied");
  assert.equal(appliedLabel({ at: "" }, now), "never applied");
  assert.equal(
    appliedLabel({ at: new Date(2026, 8, 23, 14, 2).toISOString() }, now),
    "applied today at 14:02",
  );
  assert.equal(
    appliedLabel({ at: new Date(2026, 8, 21, 9, 5).toISOString() }, now),
    "applied 21 Sep at 09:05",
  );
});

const CS2 = {
  id: "cs2",
  name: "Counter-Strike 2",
  installed: true,
  files: 4,
  target: { presetSlug: "competitive", presetName: "Competitive", version: "v2" },
  applied: {
    presetSlug: "competitive",
    version: "v2",
    at: new Date(2026, 8, 23, 14, 2).toISOString(),
  },
};
const NOW = new Date(2026, 8, 23, 18, 0);

test("an installed game with a target can be applied and imported", () => {
  assert.deepEqual(gameView(CS2, NOW), {
    id: "cs2",
    name: "Counter-Strike 2",
    dim: false,
    files: "4 files",
    preset: "Competitive",
    applied: "applied today at 14:02",
    canApply: true,
    canImport: true,
  });
});

test("a preset changed since the last apply says so", () => {
  const g = { ...CS2, target: { ...CS2.target, version: "v3" } };
  assert.equal(gameView(g, NOW).applied, "applied today at 14:02 · out of date");
});

test("a game not on this PC is listed, dimmed, with no buttons", () => {
  const v = gameView({ ...CS2, installed: false, files: 0, applied: null }, NOW);
  assert.equal(v.dim, true);
  assert.equal(v.files, "not installed here");
  assert.equal(v.canApply, false);
  assert.equal(v.canImport, false);
});

test("no Default preset yet: import is allowed, apply is not", () => {
  const v = gameView({ ...CS2, target: null, applied: null, files: 1 }, NOW);
  assert.equal(v.preset, "No Default preset yet");
  assert.equal(v.files, "1 file");
  assert.equal(v.canApply, false);
  assert.equal(v.canImport, true);
});

test("applyMessage counts files and skipped settings", () => {
  assert.equal(
    applyMessage({ wrote: ["video", "convars"], skipped: [] }),
    "Wrote 2 files, backed up first",
  );
  assert.equal(
    applyMessage({ wrote: ["video"], skipped: ["a", "b"] }),
    "Wrote 1 file, backed up first · 2 settings are not stored in files",
  );
  assert.equal(applyMessage({ wrote: [], skipped: [] }), "Nothing to write");
});

test("importMessage names what needs a hand", () => {
  assert.equal(importMessage({ unmappedSettings: 0, missingFiles: [], warnings: [] }), "Imported");
  assert.equal(
    importMessage({ unmappedSettings: 13, missingFiles: ["audio"], warnings: ["x"] }),
    "Imported · 13 settings to enter by hand · 1 file not found · x",
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test "desktop/test/**/*.test.js"`
Expected: FAIL — `Cannot find module '../ui/view.js'`.

- [ ] **Step 3: Implement `desktop/ui/view.js`**

```js
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
```

(Prettier will re-wrap some lines; run `pnpm exec prettier --write desktop` before committing.)

- [ ] **Step 4: Run the tests**

Run: `node --test "desktop/test/**/*.test.js"`
Expected: all PASS.

- [ ] **Step 5: CI and commit**

Add to `.github/workflows/ci.yml`, after the companion test line:

```yaml
- run: node --test "desktop/test/**/*.test.js"
```

Run: `pnpm exec prettier --write desktop && pnpm format:check && pnpm check`

```bash
git add desktop/ui/view.js desktop/test .github/workflows/ci.yml
git commit -m "feat(desktop): view logic for the game list, apply and import, with tests"
```

---

### Task 4: The window — connect screen, game list, apply, import

**Files:**

- Create: `desktop/ui/index.html`, `desktop/ui/style.css`, `desktop/ui/main.js`

**Interfaces:**

- Consumes: Task 2's sidecar permissions and `window.__TAURI__`; Task 3's `view.js` exports; Task 1's `login --json`.
- Produces: the finished phase-2 window.

- [ ] **Step 1: `desktop/ui/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ConfigSync</title>
    <link rel="stylesheet" href="style.css" />
    <script type="module" src="main.js"></script>
  </head>
  <body>
    <main id="app" aria-live="polite"></main>
  </body>
</html>
```

- [ ] **Step 2: `desktop/ui/style.css`**

```css
/* The app's palette, from app/globals.css. Dark only, like the web app. */
:root {
  --ground: #161826;
  --surface: #1c1f30;
  --line: #2a2d42;
  --ink: #e9e9ed;
  --ink-2: #a9aac0;
  --ink-3: #8f93ab;
  --accent: #9184d9;
  --accent-ink: #f2f0ff;
  --accent-text: #b7a6ff;
  --good: #4ade80;
  --bad: #f2736a;
  color-scheme: dark;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font:
    14px/1.45 system-ui,
    "Segoe UI",
    sans-serif;
}
main {
  padding: 16px;
  display: grid;
  gap: 12px;
}
.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
}
header.panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
h1 {
  font-size: 15px;
  margin: 0;
}
.muted {
  color: var(--ink-3);
}
.pill {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--ink-2);
}
.pill.pro {
  color: var(--accent-text);
  border-color: var(--accent);
}
.game {
  display: grid;
  gap: 4px;
}
.game.dim {
  opacity: 0.5;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.actions {
  display: flex;
  gap: 6px;
}
button {
  font: inherit;
  color: var(--ink);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 5px 12px;
  cursor: pointer;
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
input {
  font: inherit;
  width: 100%;
  color: var(--ink);
  background: var(--ground);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
}
.result.ok {
  color: var(--good);
}
.result.bad {
  color: var(--bad);
}
.stack {
  display: grid;
  gap: 10px;
}
```

- [ ] **Step 3: `desktop/ui/main.js`**

```js
import { SITE, applyMessage, gameView, importMessage, parseResult } from "./view.js";

const { Command } = window.__TAURI__.shell;
const { openUrl } = window.__TAURI__.opener;
const SIDECAR = "binaries/csync";
const app = document.getElementById("app");

const NOT_STARTED = (e) =>
  `ConfigSync could not start its companion (${e}). Reinstall the app, or use csync from a terminal.`;

/** Runs `csync <args> --json`. Never throws: every failure comes back as { ok: false, error }. */
async function csync(args) {
  try {
    return parseResult(await Command.sidecar(SIDECAR, [...args, "--json"]).execute());
  } catch (e) {
    return { ok: false, error: NOT_STARTED(e) };
  }
}

/** `csync login` with the token on stdin — never an argument, which other processes can read. */
async function login(token) {
  const cmd = Command.sidecar(SIDECAR, ["login", SITE, "--json"]);
  let stdout = "";
  cmd.stdout.on("data", (line) => (stdout += `${line}\n`));
  const closed = new Promise((resolve) => {
    cmd.on("close", ({ code }) => resolve(parseResult({ code, stdout })));
    cmd.on("error", (e) => resolve({ ok: false, error: NOT_STARTED(e) }));
  });
  try {
    const child = await cmd.spawn();
    await child.write(`${token}\n`);
  } catch (e) {
    return { ok: false, error: NOT_STARTED(e) };
  }
  return closed;
}

/** Tiny DOM builder. Text goes through textContent, never innerHTML: names are user data. */
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function show(...nodes) {
  app.replaceChildren(...nodes);
}

async function refresh() {
  show(el("p", { className: "muted", textContent: "Loading…" }));
  const r = await csync(["status"]);
  if (!r.ok) return showError(r.error);
  if (!r.data.loggedIn) return showConnect();
  showGames(r.data);
}

function showError(message) {
  show(
    el(
      "section",
      { className: "panel stack" },
      el("p", { className: "result bad", textContent: message }),
      el("div", {}, el("button", { textContent: "Retry", onclick: refresh })),
    ),
  );
}

function showConnect(error = "") {
  const token = el("input", {
    type: "password",
    placeholder: "Paste your companion token",
    autocomplete: "off",
  });
  const connect = el("button", { className: "primary", textContent: "Connect" });
  const message = el("p", { className: "result bad", textContent: error });
  const form = el(
    "form",
    { className: "panel stack" },
    el("h1", { textContent: "Connect this PC" }),
    el("p", {
      className: "muted",
      textContent: "Create a token in ConfigSync under Settings → Companion, then paste it here.",
    }),
    el(
      "div",
      {},
      el("button", {
        type: "button",
        textContent: "Open ConfigSync",
        onclick: () => openUrl(`${SITE}/settings#companion`),
      }),
    ),
    token,
    el("div", {}, connect),
    message,
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    const value = token.value.trim();
    if (!value) return;
    connect.disabled = true;
    message.textContent = "";
    const r = await login(value);
    token.value = "";
    if (!r.ok) {
      connect.disabled = false;
      message.textContent = r.error;
      return;
    }
    refresh();
  };
  show(form);
  token.focus();
}

function showGames(s) {
  const header = el(
    "header",
    { className: "panel" },
    el(
      "div",
      {},
      el("h1", { textContent: s.device }),
      el("span", { className: "muted", textContent: s.user.email }),
    ),
    el("span", { className: `pill ${s.plan}`, textContent: s.plan === "pro" ? "Pro ●" : "Free" }),
  );
  const rows = s.games.map((g) => gameRow(s, gameView(g)));
  show(
    header,
    ...(rows.length
      ? rows
      : [el("p", { className: "panel muted", textContent: "No games in the catalog yet." })]),
  );
}

function gameRow(s, v) {
  const result = el("p", { className: "result", role: "status" });
  const buttons = [];
  /** Runs one action on this row; every button on the row waits, the result lands on the row. */
  const act = (args, message, after) => async () => {
    buttons.forEach((b) => (b.disabled = true));
    result.className = "result muted";
    result.textContent = "Working…";
    const r = await csync(args);
    buttons.forEach((b) => (b.disabled = false));
    result.className = `result ${r.ok ? "ok" : "bad"}`;
    result.textContent = r.ok ? message(r.data) : r.error;
    if (r.ok) after?.(r.data);
  };
  if (v.canApply) {
    const target = s.games.find((g) => g.id === v.id).target;
    buttons.push(
      el("button", {
        className: "primary",
        textContent: "Apply",
        onclick: act(["apply", v.id, target.presetSlug], applyMessage, () =>
          setTimeout(refresh, 1500),
        ),
      }),
    );
  }
  if (v.canImport)
    buttons.push(
      el("button", {
        textContent: "Import",
        title: "Save what the game has on this PC as a new preset",
        onclick: act(["import", v.id], importMessage, (d) => openUrl(`${s.url}${d.url}`)),
      }),
    );
  return el(
    "section",
    { className: `panel game${v.dim ? " dim" : ""}` },
    el(
      "div",
      { className: "row" },
      el("strong", { textContent: v.name }),
      el("span", { className: "muted", textContent: v.files }),
    ),
    el(
      "div",
      { className: "row" },
      el("span", { textContent: v.preset }),
      el("div", { className: "actions" }, ...buttons),
    ),
    v.applied ? el("span", { className: "muted", textContent: v.applied }) : null,
    result,
  );
}

refresh();
```

Notes for the implementer:

- `refresh` after Apply waits 1.5 s so the row's result is readable before the list re-renders with the new "applied today at …".
- Import opens the new preset in the browser (the spec's "the window has no use for" editing); the row still shows the counts.
- Run `pnpm exec prettier --write desktop` — it will reflow the long `el(...)` lines.

- [ ] **Step 4: Gate**

Run: `pnpm exec prettier --write desktop && pnpm format:check && pnpm check && node --test "desktop/test/**/*.test.js"`
Expected: PASS. If eslint flags browser globals in `desktop/ui/main.js`, add a `languageOptions.globals` block scoped to `desktop/ui/**` using `globals.browser` only if `globals` is already installed; otherwise `/* global window, document */` at the top of `main.js`.

- [ ] **Step 5: Look at it (Linux, only if Rust + webkit2gtk are installed)**

Run: `pnpm build:companion && pnpm desktop:dev`
Check: the connect screen renders in the palette; with a real token the list shows CS2 and Rocket League with file counts; Apply on a closed game writes and the row turns green, then re-renders "applied today at …"; with the game open, the row shows the refusal in red. If Rust is not installed here, skip — Task 5 covers it on Windows.

- [ ] **Step 6: Commit**

```bash
git add desktop/ui
git commit -m "feat(desktop): connect screen, game list, apply and import"
```

---

### Task 5: Owner check on Windows, then PR B

No version bump or changelog: the app is not downloadable until phase 4, so no user can see this yet.

- [ ] **Step 1: Push and open PR B** (`feat/desktop-window` → `main`), body linking the spec and this plan, and listing the checklist below as unchecked.

- [ ] **Step 2: Owner, on the Windows boot** (after PR A is deployed), following `desktop/README.md`:
  1. `pnpm desktop:dev` opens a window titled ConfigSync, not a console.
  2. Logged out (no `%APPDATA%\csync\config.json`): the connect screen. "Open ConfigSync" opens the browser at `/settings#companion`.
  3. A wrong token: the CLI's message appears under the field, the screen stays.
  4. A real token: the game list, device name, email, plan pill. `%APPDATA%\csync\config.json` exists; Task Manager's command line for any `csync` process never shows the token.
  5. A game not installed is listed greyed with "not installed here" and no buttons.
  6. Apply with CS2 closed: "Wrote N files, backed up first", `.bak-*` files next to the configs, then "applied today at …".
  7. Apply with CS2 open: the refusal text, in red, nothing written.
  8. Import: the browser opens the new preset.
  9. Wi-Fi off, reopen: the error and Retry; Wi-Fi on, Retry works.
  10. Rename `desktop/src-tauri/binaries/csync-x86_64-pc-windows-msvc.exe` and restart: "could not start its companion", not a blank window.
  11. `pnpm desktop:build` produces an `.msi`; install it, run it, repeat 4 and 6.
  12. Commit `desktop/src-tauri/Cargo.lock` from the first build.

- [ ] **Step 3: Fix what the check finds, on the same branch.** Merge only on the owner's word, after `gh pr checks --watch` is green.
