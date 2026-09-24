"use client";
import * as React from "react";
import s from "@/app/(landing)/landing.module.css";
import { Odometer } from "./odometer";

/**
 * The app, live: one window with the three things people do in it. Demonstration data, drawn in
 * the page (no screenshots). Every control here mirrors something the real app does.
 */
type Game = {
  id: string;
  name: string;
  note?: string;
  settings: string[];
  presets: { name: string; tag?: string; v: string[] }[];
};

const GAMES: Game[] = [
  {
    id: "cs2",
    name: "Counter-Strike 2",
    settings: [
      "Mouse Sensitivity",
      "Zoom Sensitivity Multiplier",
      "Crosshair Length",
      "Resolution",
      "Max FPS",
      "Global Shadow Quality",
      "Multisampling",
      "Reflex Low Latency",
    ],
    presets: [
      {
        name: "Competitive",
        tag: "Default",
        v: ["1.85", "0.90", "2.5", "1920×1080", "400", "High", "4x MSAA", "Enabled"],
      },
      {
        name: "Laptop",
        v: ["1.85", "0.90", "2.5", "1280×720", "144", "Low", "None", "Enabled"],
      },
      {
        name: "LAN",
        tag: "Archived",
        v: ["1.85", "1.00", "3.0", "1920×1080", "300", "Medium", "2x MSAA", "Enabled"],
      },
    ],
  },
  {
    id: "rl",
    name: "Rocket League",
    settings: [
      "Camera FOV",
      "Camera Distance",
      "Camera Height",
      "Camera Angle",
      "Camera Stiffness",
      "Swivel Speed",
      "Frame Rate Limit",
      "Render Quality",
    ],
    presets: [
      {
        name: "Main",
        tag: "Default",
        v: ["110", "270", "100", "-4.0", "0.45", "5.0", "240", "High Quality"],
      },
      {
        name: "Low-end",
        v: ["110", "270", "100", "-4.0", "0.45", "5.0", "60", "Performance"],
      },
    ],
  },
  {
    id: "custom",
    name: "Apex Legends",
    note: "Added by you",
    settings: ["Mouse Sensitivity", "ADS Multiplier", "Field of View"],
    presets: [{ name: "Competitive", tag: "Default", v: ["2.0", "1.0", "104"] }],
  },
];

/** Competitive's snapshots, oldest first; the last one is now. */
const HISTORY = [
  {
    when: "14 Sep 18:31",
    what: "Preset created",
    v: ["2.50", "1.00", "5.0", "1280×720", "300", "High", "4x MSAA", "Enabled"],
  },
  {
    when: "18 Sep 22:05",
    what: "Resolution",
    v: ["2.50", "1.00", "5.0", "1920×1080", "300", "High", "4x MSAA", "Enabled"],
  },
  {
    when: "21 Sep 20:40",
    what: "Crosshair Length",
    v: ["2.50", "1.00", "2.5", "1920×1080", "300", "High", "4x MSAA", "Enabled"],
  },
  {
    when: "Yesterday 21:13",
    what: "Zoom, Max FPS",
    v: ["2.50", "0.90", "2.5", "1920×1080", "400", "High", "4x MSAA", "Enabled"],
  },
  {
    when: "Today 19:42",
    what: "Mouse Sensitivity",
    v: ["1.85", "0.90", "2.5", "1920×1080", "400", "High", "4x MSAA", "Enabled"],
  },
];

const TABS = ["Presets", "Compare", "History"] as const;
type Tab = (typeof TABS)[number];

/** Numbers roll; words just change. */
const Val = ({ v, delay = 0 }: { v: string; delay?: number }) =>
  /\d/.test(v) ? <Odometer value={v} delay={delay} /> : <span>{v}</span>;

export function AppWindow({ freeSnapshots }: { freeSnapshots: number }) {
  const [tab, setTab] = React.useState<Tab>("Presets");
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = (TABS.indexOf(tab) + d + TABS.length) % TABS.length;
    setTab(TABS[i]!);
    tabRefs.current[i]?.focus();
  };

  return (
    <div className={s.window}>
      <div className={s.winBar}>
        <span className={s.winDots} aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <div role="tablist" aria-label="ConfigSync" className={s.winTabs} onKeyDown={onKey}>
          {TABS.map((t, i) => (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`app-tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`app-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              className={s.winTab}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <span className={`${s.mono} ${s.dim} ${s.winUrl}`}>configsync.app</span>
      </div>
      <div
        role="tabpanel"
        id={`app-panel-${tab}`}
        aria-labelledby={`app-tab-${tab}`}
        className={s.winBody}
      >
        {tab === "Presets" ? <Presets /> : null}
        {tab === "Compare" ? <Compare /> : null}
        {tab === "History" ? <History freeSnapshots={freeSnapshots} /> : null}
      </div>
    </div>
  );
}

function Presets() {
  const [g, setG] = React.useState(0);
  const [p, setP] = React.useState(0);
  const game = GAMES[g]!;
  const preset = game.presets[Math.min(p, game.presets.length - 1)]!;
  return (
    <div className={s.cols}>
      <div className={s.col}>
        <p className={s.colTitle}>Games</p>
        {GAMES.map((x, i) => (
          <button
            key={x.id}
            className={s.item}
            aria-pressed={i === g}
            onClick={() => {
              setG(i);
              setP(0);
            }}
          >
            <span>{x.name}</span>
            <span className={s.dim}>{x.note ?? x.presets.length}</span>
          </button>
        ))}
      </div>
      <div className={s.col}>
        <p className={s.colTitle}>Presets</p>
        {game.presets.map((x, i) => (
          <button
            key={x.name}
            className={s.item}
            aria-pressed={x === preset}
            onClick={() => setP(i)}
          >
            <span>{x.name}</span>
            {x.tag ? <span className={s.tag}>{x.tag}</span> : null}
          </button>
        ))}
      </div>
      <dl className={s.rows}>
        {game.settings.map((name, i) => (
          <div key={name} className={s.row}>
            <dt>{name}</dt>
            <dd>
              <Val v={preset.v[i]!} delay={i * 20} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Compare() {
  const game = GAMES[0]!;
  const [b, setB] = React.useState(1);
  const A = game.presets[0]!;
  const B = game.presets[b]!;
  const diff = A.v.filter((v, i) => v !== B.v[i]).length;
  return (
    <div>
      <div className={s.compareHead}>
        <p>
          <span className={s.dim}>Counter-Strike 2 ·</span> {A.name}{" "}
          <span className={s.dim}>against</span>
        </p>
        <div className={s.seg} role="radiogroup" aria-label="Compare Competitive against">
          {game.presets.slice(1).map((x, i) => (
            <label key={x.name} className={s.segItem}>
              <input
                type="radio"
                name="compare-b"
                checked={b === i + 1}
                onChange={() => setB(i + 1)}
              />
              {x.name}
            </label>
          ))}
        </div>
        <p className={`${s.mono} ${s.dim}`} aria-live="polite">
          {diff} of {A.v.length} differ
        </p>
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">Setting</th>
            <th scope="col">{A.name}</th>
            <th scope="col">{B.name}</th>
          </tr>
        </thead>
        <tbody>
          {game.settings.map((name, i) => {
            const changed = A.v[i] !== B.v[i];
            return (
              <tr key={name} data-diff={changed}>
                <th scope="row">{name}</th>
                <td>{A.v[i]}</td>
                <td>
                  <span key={`${B.name}${changed}`} className={changed ? s.hit : undefined}>
                    <Val v={B.v[i]!} delay={i * 30} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function History({ freeSnapshots }: { freeSnapshots: number }) {
  const last = HISTORY.length - 1;
  const [at, setAt] = React.useState(last);
  const [restored, setRestored] = React.useState<number | null>(null);
  const snap = HISTORY[at]!;
  const now = HISTORY[last]!;
  const names = GAMES[0]!.settings;
  return (
    <div className={s.history}>
      <div className={s.scrub}>
        <label htmlFor="snap" className={s.scrubLabel}>
          <span className={s.dim}>Snapshot</span> {snap.when}{" "}
          <span className={s.dim}>· {snap.what}</span>
        </label>
        <input
          id="snap"
          type="range"
          min={0}
          max={last}
          step={1}
          value={at}
          onChange={(e) => {
            setAt(Number(e.target.value));
            setRestored(null);
          }}
          aria-valuetext={`${snap.when}, ${snap.what}`}
          style={{ "--p": `${(at / last) * 100}%` } as React.CSSProperties}
        />
        <ol className={s.ticks} aria-hidden>
          {HISTORY.map((h, i) => (
            <li key={h.when} data-on={i <= at}>
              {h.when.replace(/ \d\d:\d\d$/, "")}
            </li>
          ))}
        </ol>
      </div>
      <dl className={s.rows}>
        {names.map((name, i) => (
          <div key={name} className={s.row} data-diff={snap.v[i] !== now.v[i]}>
            <dt>{name}</dt>
            <dd>
              <Val v={snap.v[i]!} delay={i * 20} />
            </dd>
          </div>
        ))}
      </dl>
      <div className={s.restore}>
        <button
          className={`${s.btn} ${s.btnGhost} ${s.btnSm}`}
          disabled={at === last}
          onClick={() => setRestored(at)}
        >
          {restored === at ? "Restored" : "Restore this snapshot"}
        </button>
        <p className={s.dim} aria-live="polite">
          {restored === at
            ? "Your current state was saved as a snapshot first."
            : `Free keeps ${freeSnapshots} snapshots per preset. Pro keeps all of them.`}
        </p>
      </div>
    </div>
  );
}
