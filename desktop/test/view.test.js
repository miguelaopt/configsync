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
