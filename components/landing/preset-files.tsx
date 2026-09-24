"use client";
import * as React from "react";
import s from "@/app/(landing)/landing.module.css";

/**
 * Presets as tabs over the file they write. Picking one shows its cs2_video.txt, with the lines
 * that differ from Competitive marked — the compare view, in the file's own terms.
 */
const KEYS = [
  "setting.videocfg_shadow_quality",
  "setting.videocfg_texture_detail",
  "setting.videocfg_ao_detail",
  "setting.videocfg_fsr_detail",
  "setting.r_low_latency",
  "setting.mat_vsync",
] as const;

const PRESETS = [
  { id: "competitive", name: "Competitive", tag: "Default", v: ["2", "2", "2", "0", "1", "0"] },
  { id: "laptop", name: "Laptop", tag: null, v: ["0", "0", "0", "2", "1", "0"] },
  { id: "lan", name: "LAN", tag: "Archived", v: ["1", "2", "0", "0", "1", "0"] },
];
const BASE = PRESETS[0]!.v;

export function PresetFiles() {
  const [active, setActive] = React.useState(1);
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const p = PRESETS[active]!;
  const diff = p.v.filter((x, i) => x !== BASE[i]).length;

  const onKey = (e: React.KeyboardEvent) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + PRESETS.length) % PRESETS.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className={s.presets}>
      <div
        role="tablist"
        aria-label="Counter-Strike 2 presets"
        className={s.tabs}
        onKeyDown={onKey}
      >
        {PRESETS.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={i === active}
            aria-controls="preset-file"
            tabIndex={i === active ? 0 : -1}
            className={s.tab}
            onClick={() => setActive(i)}
          >
            <span>{x.name}</span>
            {x.tag ? <span className={s.tabTag}>{x.tag}</span> : null}
          </button>
        ))}
      </div>
      <section role="tabpanel" id="preset-file" aria-labelledby={`tab-${p.id}`} className={s.pane}>
        <header className={s.paneBar}>
          <span className={`${s.paneTitle} ${s.mono}`}>cs2_video.txt</span>
          <span className={s.paneMeta}>
            {active === 0
              ? "The Default preset"
              : `${diff} ${diff === 1 ? "line differs" : "lines differ"} from Competitive`}
          </span>
        </header>
        <pre className={s.code}>
          {KEYS.map((k, i) => {
            const changed = p.v[i] !== BASE[i];
            return (
              <span key={k} className={s.line} data-mark={changed}>
                <span className={s.ln} aria-hidden>
                  {i + 1}
                </span>
                {"\t"}
                <span className={s.k}>&quot;{k}&quot;</span>
                {"\t"}
                {changed ? (
                  <>
                    <del className={s.old}>&quot;{BASE[i]}&quot;</del>{" "}
                  </>
                ) : null}
                <span className={s.v}>
                  &quot;
                  {p.v[i]}
                  &quot;
                </span>
                {"\n"}
              </span>
            );
          })}
        </pre>
      </section>
    </div>
  );
}
