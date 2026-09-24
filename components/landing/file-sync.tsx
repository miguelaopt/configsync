"use client";
import * as React from "react";
import s from "@/app/(landing)/landing.module.css";

/**
 * The hero: one preset, two PCs, the real CS2 file. A value changes in the preset; win-01 copies
 * its file and rewrites the line; thinkpad-x1 has CS2 open, so nothing is written until it closes.
 * That is the companion's contract (see companion/lib/apply.mjs), acted out.
 *
 * Steps, each held for STEPS[i].hold ms, then the next cycle swaps the two values.
 * Reduced motion: the last step, still.
 */
const VALUES = ["1.85", "2.40"] as const;
const FILE = "cs2_user_convars_0_slot0.vcfg";
const STAMPS = ["2026-09-24T19-42-03-114Z", "2026-09-24T21-07-55-902Z"];

type Pc = { state: "same" | "stale" | "running" | "backup" | "written"; note: string };
const STEPS: { hold: number; edited: boolean; a: Pc; b: Pc }[] = [
  {
    hold: 2200,
    edited: false,
    a: { state: "same", note: "Matches the preset" },
    b: { state: "same", note: "Matches the preset" },
  },
  {
    hold: 1300,
    edited: true,
    a: { state: "stale", note: "Out of date" },
    b: { state: "running", note: "cs2.exe is running. Nothing written." },
  },
  {
    hold: 900,
    edited: true,
    a: { state: "backup", note: "Copied the file first" },
    b: { state: "running", note: "cs2.exe is running. Nothing written." },
  },
  {
    hold: 2000,
    edited: true,
    a: { state: "written", note: "Wrote 1 file, backed up first" },
    b: { state: "running", note: "cs2.exe is running. Nothing written." },
  },
  {
    hold: 900,
    edited: true,
    a: { state: "written", note: "Wrote 1 file, backed up first" },
    b: { state: "backup", note: "CS2 closed. Copied the file first" },
  },
  {
    hold: 3000,
    edited: true,
    a: { state: "written", note: "Wrote 1 file, backed up first" },
    b: { state: "written", note: "Wrote 1 file, backed up first" },
  },
];
const LAST = STEPS.length - 1;

const REDUCED = "(prefers-reduced-motion: reduce)";
const isReduced = () => window.matchMedia(REDUCED).matches;
const subscribeReduced = (cb: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function FileSync() {
  const [cycle, setCycle] = React.useState(0);
  const [step, setStep] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = React.useSyncExternalStore(subscribeReduced, isReduced, () => false);
  React.useEffect(() => {
    if (reduced) return;
    // Runs only while on screen and the tab is visible; resumes where it stopped.
    let c = 0;
    let i = 0;
    let onScreen = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      setCycle(c);
      setStep(i);
      timer = setTimeout(() => {
        i = (i + 1) % STEPS.length;
        if (i === 0) c += 1;
        tick();
      }, STEPS[i]!.hold);
    };
    const sync = () => {
      const run = onScreen && !document.hidden;
      if (run && !timer) tick();
      if (!run && timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = e!.isIntersecting;
      sync();
    });
    if (ref.current) io.observe(ref.current);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      clearTimeout(timer);
    };
  }, [reduced]);

  const at = reduced ? LAST : step;
  const st = STEPS[at]!;
  const from = VALUES[cycle % 2]!;
  const to = VALUES[(cycle + 1) % 2]!;
  const preset = st.edited ? to : from;
  const stamp = STAMPS[cycle % 2]!;

  return (
    <div ref={ref} className={s.sync}>
      <section className={s.pane} aria-label="The preset, in ConfigSync">
        <header className={s.paneBar}>
          <span className={s.paneTitle}>Counter-Strike 2</span>
          <span className={s.paneMeta}>Competitive preset</span>
        </header>
        <dl className={s.presetRows}>
          <div className={s.presetRow} data-live={st.edited && at < LAST}>
            <dt>Mouse Sensitivity</dt>
            <dd className={s.num}>
              <span key={preset} className={s.swap}>
                {preset}
              </span>
            </dd>
          </div>
          <div className={s.presetRow}>
            <dt>Zoom Sensitivity Multiplier</dt>
            <dd className={s.num}>0.90</dd>
          </div>
          <div className={s.presetRow}>
            <dt>Crosshair Style</dt>
            <dd>Classic Static</dd>
          </div>
        </dl>
        <p className={s.paneFoot}>Saved in ConfigSync</p>
      </section>

      <Pc host="win-01" pc={st.a} from={from} to={to} stamp={stamp} />
      <Pc host="thinkpad-x1" pc={st.b} from={from} to={to} stamp={stamp} />
    </div>
  );
}

function Pc({
  host,
  pc,
  from,
  to,
  stamp,
}: {
  host: string;
  pc: Pc;
  from: string;
  to: string;
  stamp: string;
}) {
  const value = pc.state === "written" ? to : from;
  const backedUp = pc.state === "backup" || pc.state === "written";
  return (
    <section className={s.pane} data-state={pc.state} aria-label={`The CS2 file on ${host}`}>
      <header className={s.paneBar}>
        <span className={s.paneTitle}>{host}</span>
        <span className={`${s.paneMeta} ${s.mono}`}>{FILE}</span>
      </header>
      <pre className={s.code}>
        <Line n={3}>
          {"\t"}
          <K>&quot;convars&quot;</K>
        </Line>
        <Line n={4}>{"\t{"}</Line>
        <Line n={5} mark={pc.state === "written"}>
          {"\t\t"}
          <K>&quot;sensitivity&quot;</K>
          {"\t"}
          <V>
            &quot;
            <span key={value} className={s.swap}>
              {value}
            </span>
            &quot;
          </V>
        </Line>
        <Line n={6}>
          {"\t\t"}
          <K>&quot;zoom_sensitivity_ratio&quot;</K>
          {"\t"}
          <V>&quot;0.9&quot;</V>
        </Line>
        <Line n={7}>
          {"\t\t"}
          <K>&quot;cl_crosshairstyle&quot;</K>
          {"\t"}
          <V>&quot;4&quot;</V>
        </Line>
        <Line n={8}>{"\t}"}</Line>
      </pre>
      <div className={s.bakWrap} data-show={backedUp}>
        <p className={`${s.bak} ${s.mono}`}>
          <span className={s.bakPlus}>+</span> {FILE}.bak-{stamp}
        </p>
      </div>
      <p className={s.paneFoot} data-tone={pc.state} role="status" aria-live="off">
        {pc.note}
      </p>
    </section>
  );
}

function Line({ n, mark, children }: { n: number; mark?: boolean; children: React.ReactNode }) {
  return (
    <span className={s.line} data-mark={mark}>
      <span className={s.ln} aria-hidden>
        {n}
      </span>
      {children}
      {"\n"}
    </span>
  );
}

const K = ({ children }: { children: React.ReactNode }) => <span className={s.k}>{children}</span>;
const V = ({ children }: { children: React.ReactNode }) => <span className={s.v}>{children}</span>;
