import { getCatalogGame } from "@/lib/catalog";
import s from "@/app/(landing)/landing.module.css";
import { LiveLine } from "./hero-sync";

/**
 * The v3 background layers. Everything here is drawn by the page (CSS and inline SVG) from our
 * own data; no game artwork. Server-rendered: only the four crosshair lines of the wall hydrate.
 */

/** Convars the hero editor changes; their wall lines follow it live. */
const LIVE = new Set([
  "cl_crosshairsize",
  "cl_crosshairgap",
  "cl_crosshairthickness",
  "cl_crosshairdot",
]);

type Line = { k: string; v: string };

/** Every file-backed setting of both catalog games, as the key and value the file holds. */
function configLines(): Line[] {
  const out: Line[] = [];
  for (const id of ["cs2", "rocket-league"]) {
    const g = getCatalogGame(id);
    for (const c of g?.presets[0]?.categories ?? [])
      for (const x of c.settings) {
        const k = x.source && "key" in x.source ? x.source.key : null;
        if (!k || typeof x.value === "object") continue;
        const v =
          typeof x.value === "boolean"
            ? id === "cs2"
              ? String(x.value)
              : x.value
                ? "True"
                : "False"
            : String(x.value);
        out.push({ k, v });
      }
  }
  return out;
}

/** Deterministic shuffle, so the server and every visit draw the same wall. */
function rotate<T>(xs: T[], by: number) {
  const n = ((by % xs.length) + xs.length) % xs.length;
  return [...xs.slice(n), ...xs.slice(0, n)];
}

const COLUMNS = [
  { shift: 0, dur: 140 },
  { shift: 23, dur: 190 },
  { shift: 47, dur: 120 },
  { shift: 11, dur: 170 },
  { shift: 61, dur: 150 },
  { shift: 35, dur: 210 },
];

/**
 * Full-bleed wall of real config lines behind the hero, in columns drifting at different slow
 * speeds. Each column is its list twice, moved up by half its height, so the loop is seamless.
 */
export function ConfigWall() {
  const lines = configLines();
  return (
    <div aria-hidden className={s.wall}>
      {COLUMNS.map((col, ci) => {
        const list = rotate(lines, col.shift).slice(0, 42);
        return (
          <div key={ci} className={s.wallCol} style={{ animationDuration: `${col.dur}s` }}>
            {[0, 1].map((copy) =>
              list.map((l, i) =>
                LIVE.has(l.k) ? (
                  <LiveLine key={`${copy}-${i}`} k={l.k} />
                ) : (
                  // Drawn as ::before content, not text: pure decoration, no contrast audit.
                  <span key={`${copy}-${i}`} data-l={`"${l.k}"  "${l.v}"`} />
                ),
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Contour lines around two low hills: a survey map, not a game map. */
function contours() {
  const paths: string[] = [];
  const hills = [
    { cx: 300, cy: 150, rings: 9, a: 1.3 },
    { cx: 90, cy: 300, rings: 6, a: 2.1 },
  ];
  for (const h of hills)
    for (let r = 1; r <= h.rings; r++) {
      const base = r * 22;
      const pts: string[] = [];
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * Math.PI * 2;
        const rr =
          base * (1 + 0.16 * Math.sin(3 * t + h.a + r * 0.35) + 0.08 * Math.sin(5 * t - r * 0.5));
        pts.push(
          `${(h.cx + rr * Math.cos(t)).toFixed(1)},${(h.cy + rr * 0.72 * Math.sin(t)).toFixed(1)}`,
        );
      }
      paths.push(`M${pts.join("L")}Z`);
    }
  return paths;
}

/** Per-game texture behind a game tile, in the game's own catalog accent. */
export function GameTexture({ game }: { game: "cs2" | "rl" | "any" }) {
  if (game === "any") return <span aria-hidden className={`${s.tex} ${s.texDots}`} />;
  if (game === "cs2")
    return (
      <span aria-hidden className={`${s.tex} ${s.texCs2}`}>
        <svg viewBox="0 0 480 360" preserveAspectRatio="xMidYMid slice" className={s.texSvg}>
          {contours().map((d, i) => (
            <path key={i} d={d} pathLength={1} style={{ transitionDelay: `${i * 40}ms` }} />
          ))}
        </svg>
      </span>
    );
  return (
    <span aria-hidden className={`${s.tex} ${s.texRl}`}>
      <svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMid slice" className={s.texSvg}>
        <rect x="40" y="30" width="400" height="240" rx="48" pathLength={1} />
        <path d="M240 30V270" pathLength={1} />
        <circle cx="240" cy="150" r="46" pathLength={1} />
        <path d="M40 100H96V200H40" pathLength={1} />
        <path d="M440 100H384V200H440" pathLength={1} />
      </svg>
    </span>
  );
}

/**
 * Maps any photo to two brand colours: shadows to the ground (#161826), highlights to the
 * lavender (#B7A6FF). Referenced by CSS as url(#cs-duotone).
 */
export function DuotoneFilter() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <filter id="cs-duotone" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.086 0.718" />
          <feFuncG type="table" tableValues="0.094 0.651" />
          <feFuncB type="table" tableValues="0.149 1" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}

/** Film grain over the whole page: one small turbulence tile, repeated; painted once. */
export function Grain() {
  return <div aria-hidden className={s.grain} />;
}
