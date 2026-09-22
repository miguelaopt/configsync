import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  diffLines,
  diffSnapshot,
  gameDirsIn,
  isConfigCandidate,
  snapshot,
  walkConfigFiles,
} from "../lib/discover.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "csync-discover-"));

test("isConfigCandidate takes settings files and leaves data alone", () => {
  assert.equal(isConfigCandidate("TASystemSettings.ini", 30_000), true);
  assert.equal(isConfigCandidate("cs2_video.txt", 900), true);
  assert.equal(isConfigCandidate("cs2_user_convars_0_slot0.vcfg", 3000), true);
  assert.equal(isConfigCandidate("profile.save", 4000), false);
  assert.equal(isConfigCandidate("cover.png", 4000), false);
  assert.equal(isConfigCandidate("empty.ini", 0), false);
  assert.equal(isConfigCandidate("huge.json", 5 * 1024 * 1024), false); // data, not settings
});

test("diffLines names the key that moved, both sides", () => {
  const before = '"fps_max"\t\t"400"\n"snd_mixahead"\t\t"0.025"\n';
  const after = '"fps_max"\t\t"240"\n"snd_mixahead"\t\t"0.025"\n';
  const d = diffLines(before, after);
  assert.deepEqual(d.removed, ['"fps_max"\t\t"400"']);
  assert.deepEqual(d.added, ['"fps_max"\t\t"240"']);
});

test("diffLines stays quiet when only the order or blank lines change", () => {
  const d = diffLines("a=1\nb=2\n", "\nb=2\n\na=1\n");
  assert.deepEqual(d.removed, []);
  assert.deepEqual(d.added, []);
});

test("walkConfigFiles skips log directories and non-config files", () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, "Config"));
    mkdirSync(join(dir, "Logs"));
    writeFileSync(join(dir, "Config", "Game.ini"), "x=1");
    writeFileSync(join(dir, "Config", "art.png"), "x");
    writeFileSync(join(dir, "Logs", "Launch.txt"), "noise");
    const found = walkConfigFiles(dir).map((f) => f.path);
    assert.deepEqual(found, [join(dir, "Config", "Game.ini")]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("walkConfigFiles stops at its budget instead of walking a whole install", () => {
  const dir = tmp();
  try {
    for (let i = 0; i < 10; i++) writeFileSync(join(dir, `f${i}.ini`), "x=1");
    assert.equal(walkConfigFiles(dir, { budget: { n: 3 } }).length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gameDirsIn matches loosely and looks through a publisher folder", () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, "RocketLeague"));
    mkdirSync(join(dir, "Respawn"));
    mkdirSync(join(dir, "Respawn", "Apex"));
    mkdirSync(join(dir, "SomethingElse"));
    assert.deepEqual(gameDirsIn(dir, "Rocket League"), [join(dir, "RocketLeague")]);
    assert.deepEqual(gameDirsIn(dir, "Apex Legends"), [join(dir, "Respawn", "Apex")]);
    assert.deepEqual(gameDirsIn(dir, "Half-Life"), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("snapshot then a real edit: the diff names the exact line", () => {
  const dir = tmp();
  try {
    const cfg = join(dir, "Config");
    mkdirSync(cfg);
    const file = join(cfg, "GameUserSettings.ini");
    writeFileSync(file, "[Display]\nResolutionSizeX=1920\nFullscreenMode=0\n");
    // A game the catalog has never heard of: only an install dir, no launcher folders.
    const game = { source: "steam", appId: "999999", name: "Nothing Real", installDir: dir };
    const before = snapshot(game);
    assert.equal(Object.keys(before.files).length, 1);

    writeFileSync(file, "[Display]\nResolutionSizeX=2560\nFullscreenMode=0\n");
    const changes = diffSnapshot(before, snapshot(game));
    assert.equal(changes.length, 1);
    assert.equal(changes[0].path, file);
    assert.deepEqual(changes[0].removed, ["ResolutionSizeX=1920"]);
    assert.deepEqual(changes[0].added, ["ResolutionSizeX=2560"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("snapshot ignores binary files that happen to carry a config extension", () => {
  const dir = tmp();
  try {
    writeFileSync(join(dir, "settings.ini"), Buffer.from([0x41, 0x00, 0x42, 0x0a]));
    const game = { source: "steam", appId: "999999", name: "Nothing Real", installDir: dir };
    assert.deepEqual(Object.keys(snapshot(game).files), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
