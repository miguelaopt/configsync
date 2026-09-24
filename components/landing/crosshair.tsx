/**
 * A CS2-style classic static crosshair (cl_crosshairstyle 4), drawn from the same four numbers
 * the game keeps in cs2_user_convars_0_slot0.vcfg. Our own drawing, not the game's asset.
 */
export type Xhair = {
  /** cl_crosshairsize, 0–10 */
  size: number;
  /** cl_crosshairgap, -5–5 */
  gap: number;
  /** cl_crosshairthickness, 0–5 */
  thickness: number;
  /** cl_crosshairdot */
  dot: boolean;
  /** Index into XHAIR_COLORS. */
  color: number;
};

/** Crosshair colours, all taken from the palette in app/globals.css. */
export const XHAIR_COLORS = [
  { name: "Green", hex: "#4ade80" },
  { name: "Lavender", hex: "#b7a6ff" },
  { name: "White", hex: "#e9e9ed" },
  { name: "Blue", hex: "#7fb0ff" },
] as const;

export const XHAIR_START: Xhair = { size: 2.5, gap: -2, thickness: 1, dot: false, color: 0 };

/**
 * `reach`: how far from the centre the box extends, in units. Fixed per use, so the box never
 * resizes as the crosshair changes; a smaller reach draws the same crosshair bigger.
 */
export function Crosshair({
  x,
  className,
  reach = 15,
}: {
  x: Xhair;
  className?: string;
  reach?: number;
}) {
  const len = x.size;
  const off = (x.gap + 5) * 0.5;
  const th = Math.max(0.4, x.thickness * 0.8);
  const fill = XHAIR_COLORS[x.color]?.hex ?? XHAIR_COLORS[0].hex;
  const arm = (rx: number, ry: number, w: number, h: number) => (
    <rect x={rx} y={ry} width={w} height={h} />
  );
  return (
    <svg
      viewBox={`${-reach} ${-reach} ${reach * 2} ${reach * 2}`}
      className={className}
      aria-hidden
      fill={fill}
      stroke="#0b0c14"
      strokeWidth={0.5}
      paintOrder="stroke"
      shapeRendering="crispEdges"
    >
      {len > 0 ? (
        <>
          {arm(off, -th / 2, len, th)}
          {arm(-off - len, -th / 2, len, th)}
          {arm(-th / 2, -off - len, th, len)}
          {arm(-th / 2, off, th, len)}
        </>
      ) : null}
      {x.dot ? arm(-th / 2, -th / 2, th, th) : null}
    </svg>
  );
}
