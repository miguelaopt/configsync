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
