/** Unreal-style INI (Rocket League). Sections repeat; the first wins. Patching keeps line endings. */
export type IniDoc = Record<string, Record<string, string>>;

export function parseIni(text: string): IniDoc {
  const doc: IniDoc = {};
  let current = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      current = header[1]!;
      doc[current] ??= {};
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const section = (doc[current] ??= {});
    if (!(key in section)) section[key] = line.slice(eq + 1).trim();
  }
  return doc;
}

export function patchIni(text: string, section: string, updates: Record<string, string>): string {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `[${section}]`);
  if (start < 0) throw new Error(`Section [${section}] not found`);
  let end = lines.findIndex((l, i) => i > start && /^\s*\[.+\]\s*$/.test(l));
  if (end < 0) end = lines.length;
  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex(
      (l, i) => i > start && i < end && l.slice(0, l.indexOf("=")).trim() === key,
    );
    if (idx >= 0) {
      lines[idx] = `${key}=${value}`;
    } else {
      let at = end;
      while (at > start + 1 && lines[at - 1]!.trim() === "") at--;
      lines.splice(at, 0, `${key}=${value}`);
      end++;
    }
  }
  return lines.join(nl);
}
