import test from "node:test";
import assert from "node:assert/strict";
import { reportable } from "../lib/state.mjs";

const at = "2026-09-19T10:00:00.000Z";
const state = { applied: { cs2: { presetSlug: "main", version: "aaaa", at } } };

test("reportable tags applied, waiting and failed games", () => {
  assert.deepEqual(reportable(state), {
    cs2: { presetSlug: "main", version: "aaaa", at, status: "applied" },
  });
  assert.equal(reportable(state, { waiting: new Set(["cs2"]) }).cs2.status, "waiting");
  assert.equal(
    reportable(state, { waiting: new Set(["cs2"]), failed: new Set(["cs2"]) }).cs2.status,
    "failed",
  );
});
test("games that are waiting before any write are reported with empty fields", () => {
  const r = reportable(state, { waiting: new Set(["rocket-league"]) });
  assert.deepEqual(r["rocket-league"], { presetSlug: "", version: "", at: "", status: "waiting" });
});
test("a missing `at` (in-memory record) is sent as an empty string", () => {
  const r = reportable({ applied: { cs2: { presetSlug: "main", version: "aaaa" } } });
  assert.equal(r.cs2.at, "");
});
