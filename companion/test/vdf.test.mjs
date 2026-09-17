import test from "node:test";
import assert from "node:assert/strict";
import { parseVdf } from "../lib/vdf.mjs";

test("parses libraryfolders.vdf shape", () => {
  const doc = parseVdf(
    '"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"/home/me/.steam/steam"\n\t\t"apps"\n\t\t{\n\t\t\t"730"\t\t"123"\n\t\t}\n\t}\n}\n',
  );
  assert.equal(doc.libraryfolders["0"].path, "/home/me/.steam/steam");
  assert.equal(doc.libraryfolders["0"].apps["730"], "123");
});

test("skips comments and unquotes escapes", () => {
  const doc = parseVdf('// header\n"a" "x\\"y"\n"b" { "c" "1" }\n');
  assert.equal(doc.a, 'x"y');
  assert.equal(doc.b.c, "1");
});
