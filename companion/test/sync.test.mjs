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
