/**
 * Valve KeyValues (VDF) reader — same grammar as lib/game-configs/formats/keyvalues.ts.
 * Duplicated on purpose: the CLI has no build step and no access to the app's TypeScript.
 */
const TOKEN = /"((?:[^"\\]|\\.)*)"|\{|\}|\/\/[^\n]*|[^\s{}"]+/g;

const unquote = (t) => (t.startsWith('"') ? t.slice(1, -1).replace(/\\(["\\])/g, "$1") : t);

export function parseVdf(text) {
  const tokens = [];
  for (const m of text.matchAll(TOKEN)) if (!m[0].startsWith("//")) tokens.push(m[0]);
  let i = 0;
  const parseObject = () => {
    const obj = {};
    while (i < tokens.length) {
      const t = tokens[i++];
      if (t === "}") return obj;
      const next = tokens[i];
      if (next === "{") {
        i++;
        obj[unquote(t)] = parseObject();
      } else if (next !== undefined && next !== "}") {
        i++;
        obj[unquote(t)] = unquote(next);
      }
    }
    return obj;
  };
  return parseObject();
}
