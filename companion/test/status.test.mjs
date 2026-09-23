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
