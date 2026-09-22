import test from "node:test";
import assert from "node:assert/strict";
import { basename } from "node:path";
import { applyPreset } from "../lib/apply.mjs";

/**
 * The contract the whole product is sold on: the companion never writes while the game runs.
 * No stubbing — this test process *is* node, so naming node as the game's process makes the real
 * scan find it. Delete the guard and applyPreset gets as far as "No config files found" instead,
 * which is a different error, so this fails.
 */
test("applyPreset refuses to write while the game is running", async () => {
  const game = { name: "Fake Game", processNames: [basename(process.execPath)], files: [] };
  await assert.rejects(
    () => applyPreset({ url: "http://127.0.0.1:1", token: "t" }, game, "default"),
    /Fake Game is running/,
  );
});

test("a dry run is allowed while the game is running — it only reads", async () => {
  const game = { name: "Fake Game", processNames: [basename(process.execPath)], files: [] };
  await assert.rejects(
    () => applyPreset({ url: "http://127.0.0.1:1", token: "t" }, game, "default", { dryRun: true }),
    /No Fake Game config files found/,
  );
});
