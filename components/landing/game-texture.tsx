import s from "@/app/(landing)/landing.module.css";

/** Game tile textures, drawn by the page from our own geometry; no game artwork. */

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
