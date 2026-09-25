/**
 * Maps every Counter-Strike 2 setting in the catalog to where the game keeps it, from the game's
 * own UI definitions instead of by hand.
 *
 *   pnpm exec tsx scripts/cs2-extract-settings.ts [--commit <sha>] [--local <cfg dir>]
 *
 * Source: github.com/SteamTracking/GameTracking-CS2, pinned to one commit (default: its latest),
 * which carries the decompiled Panorama settings layouts, the English strings and the convar dump.
 *
 * - The layouts name each control's convar or bind and the value every choice stores.
 * - The convar dump's flags say which file keeps it: `per_user` → cs2_user_convars_0_slot0.vcfg,
 *   other `archive` convars → cs2_machine_convars.vcfg, anything else is not saved at all.
 * - `--local` (read-only) adds whether your own config files hold the key, as evidence.
 *
 * Writes docs/catalog/cs2-settings-map.{json,md}. Changes nothing in the catalog: applying the
 * mapping is a separate, reviewed step. Re-run after a CS2 update and diff the JSON.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const REPO = "SteamTracking/GameTracking-CS2";
const PANORAMA = "game/csgo/pak01_dir/panorama/layout/settings";
const LAYOUTS: Record<string, string> = {
  "settings_game.xml": "Game",
  "settings_audio.xml": "Audio",
  "settings_video.xml": "Video",
  "settings_kbmouse.xml": "Keyboard / Mouse",
  "settings_crosshair.xml": "Crosshair",
};
/** Layouts read for their convars only: their labels sit after the controls, so names can't pair. */
const KEY_ONLY_LAYOUTS = [
  "game/csgo/pak01_dir/panorama/layout/popups/popup_hud_edge_positions.xml",
];
const STRINGS = "game/csgo/pak01_dir/resource/csgo_english.txt";
const CONVARS = "DumpSource2/convars.txt";

/** Settings whose choices come from this PC's hardware: never copied blindly to another PC. */
const PER_MACHINE =
  /^(display|resolution|refresh rate|audio device|voice input audio device|nvidia g-sync|nvidia reflex low latency|amd radeon anti-lag 2|laptop power savings)$/i;

// ---------------------------------------------------------------------------------------------
// Parsing

export type Node = {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
  parent: Node | null;
  line: number;
};

const ENTITIES: Record<string, string> = { apos: "'", quot: '"', amp: "&", lt: "<", gt: ">" };
const decode = (s: string) => s.replace(/&(apos|quot|amp|lt|gt);/g, (_, e: string) => ENTITIES[e]!);

/** Panorama layouts are well-formed XML; a tag tokenizer is all they need. */
export function parseXml(xml: string): Node {
  const root: Node = { tag: "#root", attrs: {}, children: [], parent: null, line: 1 };
  const text = xml.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "));
  let node = root;
  for (const m of text.matchAll(
    /<(\/?)([A-Za-z][\w.-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g,
  )) {
    const [, closing, tag, rawAttrs, selfClosing] = m;
    if (closing) {
      if (node.parent) node = node.parent;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rawAttrs!.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]!] = decode(a[2]!);
    const line = text.slice(0, m.index).split("\n").length;
    const child: Node = { tag: tag!, attrs, children: [], parent: node, line };
    node.children.push(child);
    if (!selfClosing) node = child;
  }
  return root;
}

/** `"Token" "Text"` pairs, keys lower-cased; markup inside the text is dropped. */
export function parseStrings(kv: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of kv.matchAll(/^\s*"([^"]+)"\s+"((?:[^"\\]|\\.)*)"/gm))
    out.set(
      m[1]!.toLowerCase(),
      m[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\\n/g, " ")
        .replace(/\\"/g, '"')
        .replace(/\s+/g, " ")
        .trim(),
    );
  return out;
}

export type Convar = {
  name: string;
  default: string;
  min?: number;
  max?: number;
  flags: string[];
};

/** `name default (min: a, max: b, flag flag)` lines from the DumpSource2 convar dump. */
export function parseConvars(dump: string): Map<string, Convar> {
  const out = new Map<string, Convar>();
  for (const m of dump.matchAll(/^(\S+) (.*?) \(([^()]*)\)\s*$/gm)) {
    const inside = m[3]!;
    const num = (k: string) => {
      const v = new RegExp(`${k}: (-?[\\d.]+)`).exec(inside)?.[1];
      return v == null ? undefined : Number(v);
    };
    const flags = inside
      .replace(/(min|max): -?[\d.]+,?/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    out.set(m[1]!.toLowerCase(), {
      name: m[1]!,
      default: m[2]!,
      min: num("min"),
      max: num("max"),
      flags,
    });
  }
  return out;
}

export type Control = {
  tab: string;
  section: string | null;
  name: string;
  kind: "slider" | "dropdown" | "keybind";
  convar?: string;
  bind?: string;
  id?: string;
  handler?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  percentage?: boolean;
  audiogain?: boolean;
  invert?: boolean;
  at: string;
};

const resolve = (strings: Map<string, string>, text: string | undefined) =>
  !text ? "" : text.startsWith("#") ? (strings.get(text.slice(1).toLowerCase()) ?? text) : text;

/** The label a dropdown sits beside: the nearest earlier Label sibling, looking up one level. */
function siblingLabel(node: Node): string | undefined {
  for (let p: Node | null = node, depth = 0; p?.parent && depth < 2; p = p.parent, depth++) {
    const siblings = p.parent.children;
    for (let i = siblings.indexOf(p) - 1; i >= 0; i--) {
      const s = siblings[i]!;
      if (s.tag === "Label" && s.attrs.text && !/SectionTitle/.test(s.attrs.class ?? ""))
        return s.attrs.text;
    }
  }
  return undefined;
}

/** Every setting control in one layout file, in document order, with the section it sits under. */
export function extractControls(
  xml: string,
  file: string,
  tab: string,
  strings: Map<string, string>,
): Control[] {
  const out: Control[] = [];
  let section: string | null = null;
  const at = (n: Node) => `${file}:${n.line}`;
  const walk = (n: Node) => {
    if (n.tag === "Label" && /SettingsSectionTitleLabel/.test(n.attrs.class ?? ""))
      section = resolve(strings, n.attrs.text);
    const a = n.attrs;
    if (n.tag === "CSGOSettingsSlider" || n.tag === "CSGOFrameTimeSlider") {
      out.push({
        tab,
        section,
        name: resolve(strings, a.text ?? siblingLabel(n)),
        kind: "slider",
        convar: a.convar,
        id: a.id,
        min: a.min != null ? Number(a.min) : undefined,
        max: a.max != null ? Number(a.max) : undefined,
        percentage: a.percentage === "true" || undefined,
        audiogain: a.audiogain === "true" || undefined,
        invert: a.invert === "true" || undefined,
        at: at(n),
      });
    } else if (/^C+SGOSettingsEnum(DropDown(Bind)?)?$/.test(n.tag)) {
      out.push({
        tab,
        section,
        name: resolve(strings, a.text ?? siblingLabel(n)),
        kind: "dropdown",
        convar: a.convar,
        bind: a.bind,
        id: a.id,
        handler: a.oninputsubmit,
        options: n.children
          .filter((c) => c.tag === "Label" && c.attrs.value != null)
          .map((c) => ({ label: resolve(strings, c.attrs.text), value: c.attrs.value! })),
        at: at(n),
      });
    } else if (n.tag === "CSGOSettingsKeyBinder") {
      out.push({
        tab,
        section,
        name: resolve(strings, a.text),
        kind: "keybind",
        bind: a.bind,
        id: a.id,
        at: at(n),
      });
    }
    n.children.forEach(walk);
  };
  walk(parseXml(xml));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Matching

export type CatalogEntry = {
  name: string;
  category: string;
  type: string;
  aliases: string[];
  options: { label: string; value: string }[];
  source?: Record<string, unknown>;
  where: "preset" | "menu";
};

export type Status = "from-game" | "inferred" | "manual";
export type Classification =
  "user_convar" | "machine_config" | "keybind" | "video_config" | "external" | "unknown";

export type Mapping = {
  name: string;
  /** What the game calls it, when that differs from the catalog's name: an alias to add. */
  gameLabel?: string;
  category: string;
  where: "preset" | "menu";
  status: Status;
  classification: Classification;
  perMachine: boolean;
  source?: { file: string; key?: string; bind?: string };
  valueType?: string;
  values?: Record<string, string>;
  range?: { min?: number; max?: number; stored?: "fraction" | "gain" | "inverted" };
  evidence: string[];
  todo?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
/** Convar and bind names are compared as written: cl_crosshairthickness is not cl_crosshair_thickness. */
const sameKey = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const FILE_CLASS: Record<string, Classification> = {
  keys: "keybind",
  convars: "user_convar",
  machine: "machine_config",
  video: "video_config",
};

/**
 * Controls the layouts don't wire to a convar (the colour picker, code-handled dropdowns) where
 * one convar is the plain candidate. Always "inferred": the dump and your files back them, one
 * csync discover round confirms them.
 */
export const CANDIDATES: Record<string, { convar: string; why: string }> = {
  "Horizontal Adjustment": { convar: "safezonex", why: "the HUD Edge Positions popup's X slider" },
  "Vertical Adjustment": { convar: "safezoney", why: "the HUD Edge Positions popup's Y slider" },
  Red: { convar: "cl_crosshaircolor_r", why: "the crosshair colour picker's red channel" },
  Green: { convar: "cl_crosshaircolor_g", why: "the crosshair colour picker's green channel" },
  Blue: { convar: "cl_crosshaircolor_b", why: "the crosshair colour picker's blue channel" },
  Alpha: {
    convar: "cl_crosshaircolor_a",
    why: "the colour picker's alpha; cl_crosshairalpha is hidden",
  },
  "Boost Player Contrast": {
    convar: "r_player_visibility_mode",
    why: "the only player-visibility convar; its 0/1 match the dropdown's values",
  },
};

/** The catalog file id a saved convar lives in, from its flags. */
export function convarFile(c: Convar | undefined): "convars" | "machine" | null {
  if (!c) return null;
  if (c.flags.includes("per_user")) return "convars";
  if (c.flags.includes("archive")) return "machine";
  return null;
}

function fromCandidate(
  entry: CatalogEntry,
  convars: Map<string, Convar>,
  local: Map<string, string>,
  keyOnly: Control[],
): Omit<Mapping, "name" | "category" | "where" | "perMachine" | "gameLabel"> | null {
  const cand = CANDIDATES[entry.name];
  const cv = cand && convars.get(cand.convar.toLowerCase());
  const file = convarFile(cv);
  if (!cand || !cv || !file) return null;
  const inLocal = local.get(cand.convar.toLowerCase());
  const old = (entry.source as { key?: string } | undefined)?.key;
  const replaces = old && !sameKey(old, cand.convar) ? [`replaces the catalog's "${old}"`] : [];
  // A layout that carries the convar (the HUD edge popup) makes the candidate the game's own word.
  const wired = keyOnly.find((c) => sameKey(c.convar, cand.convar));
  if (wired)
    return {
      status: "from-game",
      classification: file === "convars" ? "user_convar" : "machine_config",
      source: { file, key: cv.name },
      valueType: "number",
      range: { min: wired.min ?? cv.min, max: wired.max ?? cv.max },
      evidence: [
        `${wired.at}: ${cand.why} (convar "${cand.convar}")`,
        `dump: ${cv.name} ${cv.default} (${cv.flags.join(" ")})`,
        ...(inLocal ? [`present in your ${inLocal}`] : []),
        ...replaces,
      ],
    };
  return {
    status: "inferred",
    classification: file === "convars" ? "user_convar" : "machine_config",
    source: { file, key: cv.name },
    valueType: "number",
    range: { min: cv.min, max: cv.max },
    evidence: [
      `candidate: ${cand.why}`,
      `dump: ${cv.name} ${cv.default} (${cv.flags.join(" ")})`,
      ...(inLocal ? [`present in your ${inLocal}`] : []),
      ...replaces,
    ],
    todo: "Inferred from the dump: one csync discover round confirms it.",
  };
}

export function mapSetting(
  entry: CatalogEntry,
  controls: Control[],
  convars: Map<string, Convar>,
  local: Map<string, string>,
  keyOnly: Control[] = [],
): Mapping {
  const existing = entry.source as
    { file?: string; key?: string; bind?: string; match?: unknown; width?: string } | undefined;
  const names = new Set([entry.name, ...entry.aliases].map(norm));
  // The catalog's own key or bind is the strongest link; the label comes second.
  const byKey = controls.find(
    (x) => sameKey(x.convar, existing?.key) || sameKey(x.bind, existing?.bind),
  );
  const found = controls.filter((x) => names.has(norm(x.name)));
  // One label can repeat (a promoted copy, a second tab); prefer the control that says the most.
  const c = byKey ?? found.find((x) => x.convar || x.bind) ?? found[0];
  const perMachine = PER_MACHINE.test(entry.name);
  const base = {
    name: entry.name,
    gameLabel: c && !names.has(norm(c.name)) ? c.name : undefined,
    category: entry.category,
    where: entry.where,
    perMachine,
  };

  if (!c) {
    const cand = fromCandidate(entry, convars, local, keyOnly);
    if (cand) return { ...base, ...cand };
    const cv = existing?.key ? convars.get(existing.key.toLowerCase()) : undefined;
    if (existing?.key && (!cv || cv.flags.includes("hidden")))
      return {
        ...base,
        status: "manual",
        classification: (existing.file && FILE_CLASS[existing.file]) || "unknown",
        source: { file: existing.file!, key: existing.key },
        evidence: [
          cv
            ? `dump: ${cv.name} is hidden (${cv.flags.join(" ")}): a legacy convar the menu no longer shows`
            : `dump: no convar "${existing.key}" in this CS2 build`,
        ],
        todo: cv
          ? "The catalog writes a legacy convar: the menu uses a different one now."
          : "The catalog's key no longer exists in the game: this setting moved or was removed.",
      };
    return {
      ...base,
      status: "manual",
      classification: (existing?.file && FILE_CLASS[existing.file]) || "unknown",
      source: existing?.file
        ? { file: existing.file, key: existing.key, bind: existing.bind }
        : undefined,
      evidence: existing ? ["the catalog maps it; no control in the layouts carries that key"] : [],
      todo: "Not in the game's current settings layouts: gone from the menu, or set somewhere else.",
    };
  }
  const evidence = [`${c.at}: "${c.name}" (${c.tab}${c.section ? ` › ${c.section}` : ""})`];
  if (byKey && c === byKey && existing) evidence.push("found by the catalog's own key");
  const values = c.options?.length
    ? Object.fromEntries(c.options.map((o) => [o.label, o.value]))
    : undefined;

  if (c.kind === "keybind" || (c.bind && !c.convar)) {
    evidence.push(`binds "${c.bind}"`);
    const agrees = sameKey(existing?.bind, c.bind);
    if (existing?.bind && !agrees) evidence.push(`catalog says "${existing.bind}": conflict`);
    return {
      ...base,
      status: existing?.bind && !agrees ? "manual" : "from-game",
      classification: "keybind",
      source: { file: "keys", bind: c.bind },
      valueType: "keybind",
      evidence,
      todo:
        existing?.bind && !agrees ? "The catalog and the game disagree on the bind." : undefined,
    };
  }

  if (c.convar) {
    const cv = convars.get(c.convar.toLowerCase());
    const file = convarFile(cv);
    evidence.push(`convar "${c.convar}"`);
    if (cv) evidence.push(`dump: ${cv.name} ${cv.default} (${cv.flags.join(" ")})`);
    const localFile = local.get(c.convar.toLowerCase());
    if (localFile) evidence.push(`present in your ${localFile}`);
    if (existing?.key)
      evidence.push(
        sameKey(existing.key, c.convar)
          ? "catalog already maps the same key"
          : `catalog maps "${existing.key}": conflict`,
      );
    const stored = c.invert
      ? "inverted"
      : c.audiogain
        ? "gain"
        : c.percentage
          ? "fraction"
          : undefined;
    if (stored === "fraction") evidence.push("slider shows the stored fraction as a percentage");
    const conflict = !!existing?.key && !sameKey(existing.key, c.convar);
    const status: Status =
      !cv || !file || conflict
        ? "manual"
        : stored === "gain" || stored === "inverted"
          ? "inferred"
          : "from-game";
    return {
      ...base,
      status,
      classification: !cv ? "unknown" : file === "convars" ? "user_convar" : "machine_config",
      source: file ? { file, key: cv!.name } : undefined,
      valueType: c.kind === "slider" ? "number" : "enum",
      values,
      range:
        c.kind === "slider" ? { min: c.min ?? cv?.min, max: c.max ?? cv?.max, stored } : undefined,
      evidence,
      todo: !cv
        ? "The layout names a convar the dump doesn't have."
        : !file
          ? "The convar isn't saved (no archive flag): the game keeps it elsewhere or not at all."
          : conflict
            ? "The catalog and the game disagree on the key."
            : stored === "gain"
              ? "Audio-gain slider: the stored value is not the on-screen percentage; confirm the curve."
              : stored === "inverted"
                ? "Inverted slider: confirm how the on-screen value maps to the stored one."
                : undefined,
    };
  }

  // A control the game wires up in code (most of Video, voice mode): the layout gives the choices
  // and their values, not the key.
  evidence.push(`no convar in the layout${c.handler ? `; handled by ${c.handler}` : ""}`);
  if (existing?.file) {
    // Only a single-key mapping stores the choice's value as is; a multi-key one (Display Mode)
    // or a choice list the game fills in at run time (anti-aliasing) has nothing to compare.
    const comparable = !!existing.key && !!values && entry.options.length > 0 && !("" in values);
    const agree =
      !comparable || entry.options.every((o) => Object.values(values!).includes(o.value));
    evidence.push(
      !comparable
        ? "catalog maps it by hand; nothing in the layout to compare its values with"
        : agree
          ? "catalog's stored values match the layout's"
          : "catalog's stored values differ from the layout's",
    );
    return {
      ...base,
      status: agree ? "inferred" : "manual",
      classification: FILE_CLASS[existing.file] ?? "unknown",
      source: { file: existing.file, key: existing.key },
      valueType: c.kind === "slider" ? "number" : "enum",
      values,
      evidence,
      todo: agree ? undefined : "Stored values disagree: check with csync discover.",
    };
  }
  const cand = fromCandidate(entry, convars, local, keyOnly);
  if (cand)
    return {
      ...base,
      ...cand,
      valueType: c.kind === "slider" ? "number" : "enum",
      values,
      evidence: [...evidence, ...cand.evidence],
    };
  return {
    ...base,
    status: "manual",
    classification: c.tab === "Video" ? "video_config" : "unknown",
    valueType: c.kind === "slider" ? "number" : "enum",
    values,
    evidence,
    todo: "The game sets this in code: find the key with csync discover (the values above are what it stores).",
  };
}

// ---------------------------------------------------------------------------------------------
// Run

type CatalogJson = {
  presets: {
    categories: {
      name: string;
      settings: {
        name: string;
        type: string;
        aliases?: string[];
        options?: { label: string; value: string }[];
        source?: Record<string, unknown>;
      }[];
    }[];
  }[];
  menu?: {
    category: string;
    name: string;
    type: string;
    aliases?: string[];
    options?: { label: string; value: string }[];
  }[];
};

export function catalogEntries(cs2: CatalogJson): CatalogEntry[] {
  return [
    ...cs2.presets[0]!.categories.flatMap((c) =>
      c.settings.map((s) => ({
        name: s.name,
        category: c.name,
        type: s.type,
        aliases: s.aliases ?? [],
        options: s.options ?? [],
        source: s.source,
        where: "preset" as const,
      })),
    ),
    ...(cs2.menu ?? []).map((m) => ({
      name: m.name,
      category: m.category,
      type: m.type,
      aliases: m.aliases ?? [],
      options: m.options ?? [],
      where: "menu" as const,
    })),
  ];
}

async function fetchSource(commit: string, path: string, cache: string): Promise<string> {
  const file = join(cache, commit, path);
  if (existsSync(file)) return readFileSync(file, "utf8");
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${commit}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const text = await res.text();
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, text);
  return text;
}

/** Keys in your own config files → which file, lower-cased. Read-only. */
function localKeys(dir: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!dir || !existsSync(dir)) return out;
  for (const f of ["cs2_user_convars_0_slot0.vcfg", "cs2_machine_convars.vcfg", "cs2_video.txt"]) {
    const p = join(dir, f);
    if (!existsSync(p)) continue;
    for (const m of readFileSync(p, "utf8").matchAll(/^\s*"([^"]+)"\s+"/gm))
      if (!out.has(m[1]!.toLowerCase())) out.set(m[1]!.toLowerCase(), f);
  }
  return out;
}

function defaultLocalDir(): string | null {
  const root = join(homedir(), ".local/share/Steam/userdata");
  if (!existsSync(root)) return null;
  for (const id of readdirSync(root)) {
    const p = join(root, id, "730/local/cfg");
    if (existsSync(p)) return p;
  }
  return null;
}

function report(mappings: Mapping[], unmatched: Control[], commit: string): string {
  const by = (s: Status) => mappings.filter((m) => m.status === s);
  const lines = [
    "# CS2 settings map",
    "",
    `Generated by \`scripts/cs2-extract-settings.ts\` from ${REPO}@${commit.slice(0, 12)}.`,
    "Nothing here is in the catalog yet: this is the evidence to review before it is.",
    "",
    "| | Settings |",
    "|---|---:|",
    `| Catalog settings | ${mappings.length} (${mappings.filter((m) => m.where === "preset").length} in the preset, ${mappings.filter((m) => m.where === "menu").length} in the menu) |`,
    `| From the game's own files | ${by("from-game").length} |`,
    `| Inferred, to confirm | ${by("inferred").length} |`,
    `| Manual (csync discover) | ${by("manual").length} |`,
    `| Per machine (never copied blindly) | ${mappings.filter((m) => m.perMachine).length} |`,
    "",
    "## Inferred, to confirm",
    "",
    ...by("inferred").map(
      (m) => `- **${m.category} › ${m.name}** — ${m.todo ?? m.evidence.at(-1)}`,
    ),
    "",
    "## Manual",
    "",
    ...by("manual").map((m) => `- **${m.category} › ${m.name}** — ${m.todo ?? ""}`),
    "",
    "## In the game, not in the catalog",
    "",
    ...unmatched.map(
      (c) =>
        `- ${c.tab}${c.section ? ` › ${c.section}` : ""} › ${c.name}${c.convar ? ` (\`${c.convar}\`)` : c.bind ? ` (bind \`${c.bind}\`)` : ""}`,
    ),
    "",
    "## From the game's own files",
    "",
    "| Setting | File | Key | Values |",
    "|---|---|---|---|",
    ...by("from-game").map(
      (m) =>
        `| ${m.category} › ${m.name} | ${m.source?.file ?? ""} | \`${m.source?.key ?? m.source?.bind ?? ""}\` | ${
          m.values
            ? Object.entries(m.values)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")
            : m.range
              ? `${m.range.min ?? "?"}–${m.range.max ?? "?"}${m.range.stored === "fraction" ? " (shown as %)" : ""}`
              : ""
        } |`,
    ),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const arg = (k: string) => {
    const i = process.argv.indexOf(k);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const commit =
    arg("--commit") ??
    (
      (await (await fetch(`https://api.github.com/repos/${REPO}/commits/master`)).json()) as {
        sha: string;
      }
    ).sha;
  const cache = join(process.cwd(), "node_modules/.cache/gametracking-cs2");
  const strings = parseStrings(await fetchSource(commit, STRINGS, cache));
  const convars = parseConvars(await fetchSource(commit, CONVARS, cache));
  const controls: Control[] = [];
  for (const [file, tab] of Object.entries(LAYOUTS))
    controls.push(
      ...extractControls(
        await fetchSource(commit, `${PANORAMA}/${file}`, cache),
        file,
        tab,
        strings,
      ).filter((c) => c.name),
    );
  const keyOnly: Control[] = [];
  for (const path of KEY_ONLY_LAYOUTS)
    keyOnly.push(
      ...extractControls(
        await fetchSource(commit, path, cache),
        path.split("/").pop()!,
        "",
        strings,
      ),
    );

  const cs2 = JSON.parse(readFileSync("catalog/cs2.json", "utf8")) as CatalogJson;
  const entries = catalogEntries(cs2);
  const local = localKeys(arg("--local") ?? defaultLocalDir());
  const mappings = entries.map((e) => mapSetting(e, controls, convars, local, keyOnly));

  const known = new Set(entries.flatMap((e) => [e.name, ...e.aliases]).map(norm));
  const seen = new Set<string>();
  const unmatched = controls.filter((c) => {
    const k = norm(c.name);
    if (known.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  mkdirSync("docs/catalog", { recursive: true });
  writeFileSync(
    "docs/catalog/cs2-settings-map.json",
    JSON.stringify({ source: { repo: REPO, commit }, mappings, unmatched }, null, 2) + "\n",
  );
  writeFileSync("docs/catalog/cs2-settings-map.md", report(mappings, unmatched, commit));
  const count = (s: Status) => mappings.filter((m) => m.status === s).length;
  console.log(
    `${mappings.length} settings: ${count("from-game")} from the game, ${count("inferred")} inferred, ${count("manual")} manual; ${unmatched.length} game controls not in the catalog.`,
  );
}

// Run as a script, not when a test imports the functions above.
if (/cs2-extract-settings\.ts$/.test(process.argv[1] ?? ""))
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
