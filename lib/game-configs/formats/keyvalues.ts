/**
 * Valve KeyValues (VDF) — the format of CS2's cfg/vcfg files.
 *   "key"  "value"
 *   "key"  { nested }
 * Parsing is tolerant; patching rewrites only the values we touch.
 */
export type KVNode = { [key: string]: string | KVNode };

type Tok = { text: string; start: number; end: number };
const TOKEN = /"((?:[^"\\]|\\.)*)"|\{|\}|\/\/[^\n]*|[^\s{}"]+/g;

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(TOKEN)) {
    if (m[0].startsWith("//")) continue;
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

const unquote = (t: string) => (t.startsWith('"') ? t.slice(1, -1).replace(/\\(["\\])/g, "$1") : t);
const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function parseKeyValues(text: string): KVNode {
  const tokens = tokenize(text);
  let i = 0;
  const parseObject = (): KVNode => {
    const obj: KVNode = {};
    while (i < tokens.length) {
      const t = tokens[i++]!.text;
      if (t === "}") return obj;
      const next = tokens[i]?.text;
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

/** Offsets of the `{` and `}` tokens enclosing `path`; null when absent. */
function findSection(text: string, path: string[]): { open: number; close: number } | null {
  if (path.length === 0) return { open: -1, close: text.length };
  const tokens = tokenize(text);
  const stack: string[] = [];
  let open = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.text === "{") {
      stack.push(unquote(tokens[i - 1]?.text ?? ""));
      if (open < 0 && stack.length === path.length && path.every((p, k) => stack[k] === p))
        open = t.start;
    } else if (t.text === "}") {
      if (open >= 0 && stack.length === path.length) return { open, close: t.start };
      stack.pop();
    }
  }
  return null;
}

export function patchKeyValues(
  text: string,
  section: string[],
  updates: Record<string, string>,
): string {
  const range = findSection(text, section);
  if (!range) throw new Error(`Section "${section.join("/")}" not found`);
  let body = text.slice(range.open + 1, range.close);
  const indent = body.match(/\n([ \t]*)"/)?.[1] ?? "\t";
  for (const [key, value] of Object.entries(updates)) {
    const escaped = quote(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^([ \\t]*${escaped}[ \\t]+)"(?:[^"\\\\]|\\\\.)*"`, "m");
    if (re.test(body)) body = body.replace(re, (_m, lead: string) => `${lead}${quote(value)}`);
    else body = `${body.replace(/\s*$/, "")}\n${indent}${quote(key)}\t\t${quote(value)}\n`;
  }
  return text.slice(0, range.open + 1) + body + text.slice(range.close);
}
