"use client";
import * as React from "react";
import Link from "next/link";
import s from "@/app/(landing)/landing.module.css";
import { Crosshair, XHAIR_COLORS, XHAIR_START, type Xhair } from "./crosshair";
import { useReducedMotion } from "./use-reduced-motion";

/** The crosshair win-01 is editing, for the lines of the config wall that show it. */
const LiveXhair = React.createContext<Xhair>(XHAIR_START);

/** Wall lines that mirror the crosshair editor, by convar. */
const LIVE: Record<string, (x: Xhair) => string> = {
  cl_crosshairsize: (x) => x.size.toFixed(1),
  cl_crosshairgap: (x) => x.gap.toFixed(1),
  cl_crosshairthickness: (x) => x.thickness.toFixed(1),
  cl_crosshairdot: (x) => String(x.dot),
};

/** One line of the config wall that follows the editor: it glows and takes the new value. */
export function LiveLine({ k }: { k: string }) {
  const x = React.useContext(LiveXhair);
  const v = LIVE[k]?.(x) ?? "";
  // Glow only once the visitor has changed something, not on the first paint.
  const [first] = React.useState(v);
  const [touched, setTouched] = React.useState(false);
  if (v !== first && !touched) setTouched(true);
  return <span key={v} className={touched ? s.wallLive : undefined} data-l={`"${k}"  "${v}"`} />;
}

/** How long a change takes to travel the connector between the two machines. */
const TRAVEL = 360;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const half = (v: number) => Math.round(v * 2) / 2;

/**
 * The hero. The visitor edits a crosshair on win-01; every change is sent down the connector as a
 * pulse, and thinkpad-x1 takes the value when the pulse lands. While a pulse is in flight, newer
 * edits wait and go out as the next pulse, so a fast drag still ends on the exact last value.
 */
export function HeroSync({
  freeGames,
  dock,
  wall,
}: {
  freeGames: number;
  dock: React.ReactNode;
  /** The v3 config wall; rendered behind the frame's content, fed the live crosshair. */
  wall?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [local, setLocal] = React.useState<Xhair>(XHAIR_START);
  const [remote, setRemote] = React.useState<Xhair>(XHAIR_START);
  const [pulse, setPulse] = React.useState(0);
  const latest = React.useRef(local);
  const flying = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);

  function send() {
    const sent = latest.current;
    if (reduced) return setRemote(sent);
    flying.current = true;
    setPulse((p) => p + 1);
    timer.current = setTimeout(() => {
      setRemote(sent);
      flying.current = false;
      if (latest.current !== sent) send();
    }, TRAVEL);
  }

  const change = (patch: Partial<Xhair>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setLocal(next);
    if (!flying.current) send();
  };

  const synced = local === remote;

  // The wall's drift runs only while the hero is on screen.
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = React.useState(true);
  React.useEffect(() => {
    if (!wall || !frameRef.current) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e!.isIntersecting));
    io.observe(frameRef.current);
    return () => io.disconnect();
  }, [wall]);

  // Drag on win-01's screen: sideways for the gap, up and down for the length.
  const drag = React.useRef<{ x: number; y: number; from: Xhair } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: latest.current };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const gap = clamp(half(d.from.gap + (e.clientX - d.x) / 18), -5, 5);
    const size = clamp(half(d.from.size - (e.clientY - d.y) / 18), 0, 10);
    if (gap !== latest.current.gap || size !== latest.current.size) change({ gap, size });
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <section className={s.hero} aria-labelledby="hero-title" data-scene="hero">
      <div ref={frameRef} className={s.frame} data-paused={!onScreen}>
        <div aria-hidden className={s.bloom} />
        {wall ? <LiveXhair.Provider value={local}>{wall}</LiveXhair.Provider> : null}
        <div className={s.heroTop}>
          <h1 id="hero-title" className={s.h1}>
            <span className={s.sr}>Stop rebuilding your setup.</span>
            <span aria-hidden>
              St
              <span className={s.h1o}>
                <Crosshair x={local} reach={9} />
              </span>
              p rebuilding your setup.
            </span>
          </h1>
          <div className={s.heroAside}>
            <p className={s.sub}>Your settings, on every PC you play on.</p>
            <div className={s.actions}>
              <Link href="/sign-up" className={`${s.btn} ${s.btnPrimary}`}>
                Create a free account
              </Link>
              <a href="#product" className={`${s.btn} ${s.btnGhost}`}>
                Try the demo
              </a>
            </div>
            <ul className={s.chips} aria-label="In short">
              <li>Windows 10 and 11</li>
              <li>Free for {freeGames} games</li>
              <li>No trackers</li>
            </ul>
          </div>
        </div>

        <div className={s.rig}>
          <Machine
            host="win-01"
            hz="240Hz"
            x={local}
            status="Editing"
            tone="edit"
            screenProps={{
              onPointerDown: onDown,
              onPointerMove: onMove,
              onPointerUp: onUp,
              onPointerCancel: onUp,
              onLostPointerCapture: onUp,
              title: "Drag: sideways for the gap, up and down for the length",
            }}
            hint="Drag the crosshair"
          />
          <div className={s.link} aria-hidden>
            <span className={s.node} />
            <span className={s.track}>
              {pulse > 0 ? <span key={pulse} className={s.pulse} /> : null}
            </span>
            <span className={s.node} />
          </div>
          <Machine
            host="thinkpad-x1"
            hz="60Hz"
            x={remote}
            status={synced ? "Synced" : "Syncing"}
            tone={synced ? "synced" : "syncing"}
          />
        </div>
      </div>

      <div className={s.dock}>
        <fieldset className={s.controls}>
          <legend className={s.controlsTitle}>Crosshair on win-01</legend>
          <Slider
            label="Length"
            convar="cl_crosshairsize"
            min={0}
            max={10}
            value={local.size}
            onChange={(size) => change({ size })}
          />
          <Slider
            label="Gap"
            convar="cl_crosshairgap"
            min={-5}
            max={5}
            value={local.gap}
            onChange={(gap) => change({ gap })}
          />
          <Slider
            label="Thickness"
            convar="cl_crosshairthickness"
            min={0.5}
            max={5}
            value={local.thickness}
            onChange={(thickness) => change({ thickness })}
          />
          <div className={s.controlRow}>
            <div className={s.swatches} role="radiogroup" aria-label="Colour">
              {XHAIR_COLORS.map((c, i) => (
                <label
                  key={c.name}
                  className={s.swatch}
                  style={{ "--c": c.hex } as React.CSSProperties}
                >
                  <input
                    type="radio"
                    name="xhair-color"
                    checked={local.color === i}
                    onChange={() => change({ color: i })}
                  />
                  <span className={s.sr}>{c.name}</span>
                </label>
              ))}
            </div>
            <label className={s.toggle}>
              <input
                type="checkbox"
                checked={local.dot}
                onChange={(e) => change({ dot: e.target.checked })}
              />
              Centre dot
            </label>
          </div>
        </fieldset>
        {dock}
      </div>
    </section>
  );
}

function Machine({
  host,
  hz,
  x,
  status,
  tone,
  screenProps,
  hint,
}: {
  host: string;
  hz: string;
  x: Xhair;
  status: string;
  tone: "edit" | "syncing" | "synced";
  screenProps?: React.HTMLAttributes<HTMLDivElement>;
  hint?: string;
}) {
  return (
    <figure className={s.machine} data-tone={tone}>
      <figcaption className={s.mBar}>
        <span className={s.mono}>
          {host} <span className={s.dim}>· {hz}</span>
        </span>
        <span className={s.mStatus} role="status">
          {status}
        </span>
      </figcaption>
      <div className={s.screen} data-drag={Boolean(screenProps)} {...screenProps}>
        <Crosshair x={x} className={s.screenX} />
        {hint ? <span className={s.hint}>{hint}</span> : null}
      </div>
      <dl className={s.readout}>
        <Convar k="cl_crosshairsize" v={x.size} />
        <Convar k="cl_crosshairgap" v={x.gap} />
        <Convar k="cl_crosshairthickness" v={x.thickness} />
        <Convar k="cl_crosshairdot" v={String(x.dot)} />
      </dl>
    </figure>
  );
}

function Convar({ k, v }: { k: string; v: number | string }) {
  return (
    <div>
      <dt>&quot;{k}&quot;</dt>
      <dd>
        <span key={String(v)} className={s.flash}>
          &quot;{v}&quot;
        </span>
      </dd>
    </div>
  );
}

function Slider({
  label,
  convar,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  convar: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = React.useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={s.slider}>
      <label htmlFor={id}>
        {label} <span className={s.dim}>{convar}</span>
      </label>
      <output htmlFor={id} className={s.mono}>
        {value.toFixed(1)}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--p": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}
