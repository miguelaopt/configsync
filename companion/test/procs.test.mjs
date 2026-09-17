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
  assert.equal(isRunning(game, new Set(["cs2.exe"])), true);
  assert.equal(isRunning(game, new Set(["steam"])), false);
  assert.equal(isRunning({ processNames: [] }, new Set(["cs2"])), false);
});
test("isRunning tolerates the 15-char /proc comm truncation", () => {
  assert.equal(
    isRunning({ processNames: ["RocketLeague.exe"] }, new Set(["rocketleague.ex"])),
    true,
  );
});
