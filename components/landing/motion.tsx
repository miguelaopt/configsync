"use client";
import * as React from "react";
import s from "@/app/(landing)/landing.module.css";

/**
 * The landing page's demo loop, exactly as designed: four phases on a timer.
 *   0 Synced (1.85) → 1 Unsynced changes (desktop 2.40) → 2 Applying (beam) → 3 Synced (both 2.40)
 * Holds 2.8 s / 1.4 s / 1.2 s / 3.2 s. Reduced motion ⇒ stays at phase 0.
 */
const HOLDS = [2800, 1400, 1200, 3200];
const PhaseContext = React.createContext(0);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setPhase(i);
      timer = setTimeout(() => {
        i = (i + 1) % HOLDS.length;
        tick();
      }, HOLDS[i]);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return <PhaseContext.Provider value={phase}>{children}</PhaseContext.Provider>;
}

function usePhase() {
  const p = React.useContext(PhaseContext);
  return {
    p,
    changed: p >= 1,
    stale: p === 1 || p === 2,
    desktopSens: p >= 1 ? "2.40" : "1.85",
    laptopSens: p >= 3 ? "2.40" : "1.85",
    statusText: p === 0 || p === 3 ? "Synced" : p === 1 ? "Unsynced changes" : "Applying",
    pct: p >= 1 ? 72 : 42,
  };
}

/** Hero: the app card with the live sensitivity slider and the beam between two PCs. */
export function HeroCard() {
  const m = usePhase();
  return (
    <div className={s.card}>
      <div className={s.cardBar}>
        <span className={s.dotDim} />
        <span className={s.dotDim} />
        <span className={s.dotDim} />
        <span className={s.cardTitle}>Counter-Strike 2, Competitive preset</span>
        <span className={s.status} role="status" aria-live="polite">
          <span className={s.statusDot} data-stale={m.stale} />
          {m.statusText}
        </span>
      </div>
      <div className={s.cardBody}>
        <div className={s.row}>
          <span className={s.rowLabel}>Mouse sensitivity</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span aria-hidden className={s.slider}>
              <span className={s.sliderFill} style={{ width: `${m.pct}%` }} />
              <span className={s.sliderKnob} style={{ left: `${m.pct}%` }} />
            </span>
            <span className={s.rowVal} style={{ width: 38, textAlign: "right" }}>
              {m.desktopSens}
            </span>
          </span>
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>DPI</span>
          <span className={s.rowVal}>800</span>
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>Raw input</span>
          <span className={s.seg}>
            <span className={s.segOn}>On</span>
            <span className={s.segOff}>Off</span>
          </span>
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>Ping</span>
          <span className={s.kbd}>Mouse 4</span>
        </div>
      </div>
      <div className={s.cardFoot}>
        <span>win-01</span>
        <span className={s.beamTrack}>
          <span className={s.beam} data-show={m.p === 2} data-go={m.p >= 2} />
        </span>
        <span>thinkpad-x1</span>
        <span className={s.footVal}>{m.laptopSens}</span>
      </div>
    </div>
  );
}

/** "Set it once" section: two PCs, a vertical beam, and the three state chips. */
export function SyncCard() {
  const m = usePhase();
  return (
    <div className={s.syncCard}>
      <div className={s.pc}>
        <span>
          Desktop <span className={s.pcHost}>win-01</span>
        </span>
        <span className={s.pcVal}>{m.desktopSens}</span>
      </div>
      <div className={s.vTrack}>
        <div className={s.vLine} />
        <div className={s.vBeam} data-show={m.p === 2} data-go={m.p >= 2} />
        <span className={s.vLabel}>{m.stale ? "csync watch" : "two PCs, one preset"}</span>
      </div>
      <div className={s.pc}>
        <span>
          Laptop <span className={s.pcHost}>thinkpad-x1</span>
        </span>
        <span className={s.pcVal} data-stale={m.stale}>
          {m.laptopSens}
        </span>
      </div>
      <div className={s.chips}>
        <span className={s.chip} data-on={m.p === 0 || m.p === 3}>
          Synced
        </span>
        <span className={s.chip} data-on={m.p === 2}>
          Applying
        </span>
        <span className={s.chip} data-on={m.p === 1}>
          Unsynced changes
        </span>
      </div>
    </div>
  );
}

/** Fade-and-rise on first scroll into view, as in the design. Off under reduced motion. */
export function Reveal({
  children,
  className,
  id,
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  as?: "section" | "div";
}) {
  const ref = React.useRef<HTMLElement>(null);
  const [pre, setPre] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setPre(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      id={id}
      className={`${s.reveal} ${className ?? ""}`}
      data-pre={pre && !inView}
      data-in={inView}
    >
      {children}
    </Tag>
  );
}
