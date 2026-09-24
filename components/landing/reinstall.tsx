"use client";
import * as React from "react";
import s from "@/app/(landing)/landing.module.css";
import { Odometer } from "./odometer";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * "The reinstall": a pinned story scrubbed by scroll. Five invisible steps scroll past a pinned
 * stage; whichever step crosses the middle of the viewport sets the stage. No scroll listener,
 * one IntersectionObserver. Reduced motion: not pinned, shown at its last step.
 *
 * The terminal is csync's real output for `csync apply cs2 competitive` (companion/bin/csync.mjs,
 * companion/lib/apply.mjs), with the Steam path shortened.
 */
const ROWS = [
  { name: "Mouse Sensitivity", key: "sensitivity", yours: "1.85", fresh: "2.50" },
  { name: "Zoom Sensitivity", key: "zoom_sensitivity_ratio", yours: "0.90", fresh: "1.00" },
  { name: "Crosshair Length", key: "cl_crosshairsize", yours: "2.5", fresh: "5.0" },
  { name: "Crosshair Gap", key: "cl_crosshairgap", yours: "-2.0", fresh: "1.0" },
  { name: "Max FPS", key: "fps_max", yours: "400", fresh: "0" },
  { name: "Reflex Low Latency", key: "r_low_latency", yours: "1", fresh: "0" },
];

const STEPS = [
  { label: "Your setup", title: "It took you months to get this right." },
  { label: "Reinstall", title: "Then Windows gets reinstalled." },
  { label: "csync apply", title: "One command." },
  { label: "Backup, write", title: "Every file copied first, then written." },
  { label: "Restored", title: "Back where you left it." },
];

const CFG = "…\\730\\local\\cfg\\";
const STAMP = "2026-09-24T19-42-03-114Z";
const OUTPUT = [
  "Reading current Counter-Strike 2 files:",
  `  convars: ${CFG}cs2_user_convars_0_slot0.vcfg`,
  `  keys: ${CFG}cs2_user_keys_0_slot0.vcfg`,
  `  video: ${CFG}cs2_video.txt`,
  `  machine: ${CFG}cs2_machine_convars.vcfg`,
  "convars: sensitivity=1.85, zoom_sensitivity_ratio=0.9, cl_crosshairsize=2.5, …",
  `Wrote ${CFG}cs2_user_convars_0_slot0.vcfg (backup: ….vcfg.bak-${STAMP})`,
  `Wrote ${CFG}cs2_video.txt (backup: ….txt.bak-${STAMP})`,
  `Wrote ${CFG}cs2_machine_convars.vcfg (backup: ….vcfg.bak-${STAMP})`,
  "Done.",
];

export function Reinstall({ photo }: { photo?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [seen, setSeen] = React.useState(0);
  const steps = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    if (reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setSeen(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const el of steps.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const step = reduced ? STEPS.length - 1 : seen;
  const wiped = step >= 1 && step < 4;

  return (
    <section
      id="how"
      className={s.story}
      data-static={reduced}
      aria-labelledby="story-title"
      data-scene="story"
    >
      <div className={s.stage}>
        {photo ? (
          // Your desk, lit while the setup is yours; the room goes dark while it is wiped.
          <div aria-hidden className={s.storyPhoto} data-on={step === 0 || step === 4}>
            {photo}
          </div>
        ) : null}
        <div className={s.storyHead}>
          <h2 id="story-title" className={s.h2}>
            {STEPS[step]!.title}
          </h2>
          <ol className={s.rail} aria-hidden>
            {STEPS.map((x, i) => (
              <li key={x.label} data-on={i <= step} data-now={i === step}>
                {x.label}
              </li>
            ))}
          </ol>
        </div>

        <div className={s.storyBody}>
          <figure className={s.machine} data-tone={wiped ? "wiped" : "synced"}>
            <figcaption className={s.mBar}>
              <span className={s.mono}>
                win-01 <span className={s.dim}>· {wiped ? "fresh install" : "240Hz"}</span>
              </span>
              <span className={s.mStatus}>{wiped ? "Defaults" : "Your setup"}</span>
            </figcaption>
            <dl className={s.values} data-glitch={step === 1}>
              {ROWS.map((r, i) => (
                <div key={r.key}>
                  <dt>
                    {r.name} <span className={s.dim}>{r.key}</span>
                  </dt>
                  <dd>
                    <Odometer
                      value={wiped ? r.fresh : r.yours}
                      delay={step === 4 ? i * 140 : i * 25}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </figure>

          <figure className={s.term} aria-label="Terminal">
            <figcaption className={s.mBar}>
              <span className={s.mono}>csync</span>
              <span className={s.dim}>win-01</span>
            </figcaption>
            <pre className={s.termBody}>
              <span className={s.cmd} data-typed={step >= 2}>
                <span className={s.prompt}>$</span>{" "}
                <span className={s.typed}>csync apply cs2 competitive</span>
              </span>
              {OUTPUT.map((line, i) => (
                <span
                  key={line}
                  className={s.out}
                  data-on={step >= 3 && (i < OUTPUT.length - 1 || step >= 4)}
                  data-wrote={line.startsWith("Wrote")}
                  style={{ transitionDelay: `${step >= 3 ? i * 110 : 0}ms` }}
                >
                  {line}
                </span>
              ))}
            </pre>
          </figure>
        </div>
      </div>

      {reduced
        ? null
        : STEPS.map((x, i) => (
            <div
              key={x.label}
              data-step={i}
              className={s.step}
              ref={(el) => {
                steps.current[i] = el;
              }}
            />
          ))}
    </section>
  );
}
