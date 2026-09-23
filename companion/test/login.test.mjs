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
