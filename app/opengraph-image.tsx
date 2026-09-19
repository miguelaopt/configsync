import { ImageResponse } from "next/og";

export const alt = "ConfigSync — your game settings, everywhere";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card. Brand mark + wordmark on the brand ground; no external fonts or images. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 90px",
        background: "#161826",
        backgroundImage:
          "radial-gradient(900px 500px at 78% 8%, rgba(145,132,217,0.28), transparent 70%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width="112" height="112" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#B7A6FF" />
              <stop offset="48%" stopColor="#9184D9" />
              <stop offset="100%" stopColor="#6F5AC9" />
            </linearGradient>
          </defs>
          <path
            d="M55 16 L29 31 Q24 34 24 40 L24 51 Q24 56 29 59 L43 67 L54 58 L38 49 Q36 48 36 45 L36 41 Q36 38 39 36 L63 22 Z"
            fill="url(#g)"
          />
          <path
            d="M45 84 L71 69 Q76 66 76 60 L76 49 Q76 44 71 41 L57 33 L46 42 L62 51 Q64 52 64 55 L64 59 Q64 62 61 64 L37 78 Z"
            fill="url(#g)"
          />
        </svg>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, color: "#e9e9ed" }}>
          <span>Config</span>
          <span style={{ color: "#b7a6ff", marginLeft: -7 }}>Sync</span>
        </div>
      </div>
      <div style={{ marginTop: 40, fontSize: 52, color: "#e9e9ed", lineHeight: 1.15 }}>
        Your game settings.
      </div>
      <div style={{ marginTop: 4, fontSize: 52, color: "#b7a6ff", lineHeight: 1.15 }}>
        Everywhere.
      </div>
      <div style={{ marginTop: 32, fontSize: 28, color: "#a9aac0" }}>
        Save, compare and sync presets for any game — on every PC.
      </div>
    </div>,
    size,
  );
}
