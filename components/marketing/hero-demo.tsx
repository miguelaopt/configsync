"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Segmented } from "@/components/ui/segmented";
import { Group, Key, Panel, PanelBar, Row, Status, Val, type SyncState } from "./menu";
import { cn } from "@/lib/utils/cn";

/**
 * The hero is the app at real scale: pick a game, pick a preset, change a value, watch it sync.
 * This is the page's only motion: a value change walks the status through
 * "1 unsynced change → Syncing → Synced on 2 PCs". Nothing else moves.
 */

type Preset = "main" | "competitive" | "laptop";
const PRESETS: { label: string; value: Preset }[] = [
  { label: "Main", value: "main" },
  { label: "Competitive", value: "competitive" },
  { label: "Laptop", value: "laptop" },
];
const RESOLUTIONS = ["1920 × 1080", "1600 × 900", "1280 × 960"];

type Cs2 = { sens: number; dpi: number; raw: "On" | "Off"; res: number; hz: 144 | 240 };
type Rl = {
  fov: number;
  distance: number;
  height: number;
  stiffness: number;
  angle: number;
  deadzone: number;
};

const CS2: Record<Preset, Cs2> = {
  main: { sens: 1.85, dpi: 800, raw: "On", res: 0, hz: 240 },
  competitive: { sens: 2.1, dpi: 800, raw: "On", res: 0, hz: 240 },
  laptop: { sens: 1.85, dpi: 800, raw: "On", res: 1, hz: 144 },
};
const RL: Record<Preset, Rl> = {
  main: { fov: 110, distance: 270, height: 100, stiffness: 0.45, angle: -3.0, deadzone: 0.05 },
  competitive: {
    fov: 110,
    distance: 260,
    height: 100,
    stiffness: 0.5,
    angle: -3.0,
    deadzone: 0.05,
  },
  laptop: { fov: 110, distance: 270, height: 110, stiffness: 0.45, angle: -4.0, deadzone: 0.07 },
};

const fmt = (n: number, digits: number) => n.toFixed(digits);

export function HeroDemo() {
  const [preset, setPreset] = React.useState<Preset>("main");
  const [cs2, setCs2] = React.useState<Record<Preset, Cs2>>(CS2);
  const [rl, setRl] = React.useState<Record<Preset, Rl>>(RL);
  const [sync, setSync] = React.useState<SyncState>("synced");
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  /** The one orchestrated moment. Same states with reduced motion; only the CSS transitions go. */
  const touched = React.useCallback(() => {
    timers.current.forEach(clearTimeout);
    setSync("unsynced");
    timers.current = [
      setTimeout(() => setSync("syncing"), 700),
      setTimeout(() => setSync("synced"), 1700),
    ];
  }, []);
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const editCs2 = (patch: Partial<Cs2>) => {
    setCs2((s) => ({ ...s, [preset]: { ...s[preset], ...patch } }));
    touched();
  };
  const editRl = (patch: Partial<Rl>) => {
    setRl((s) => ({ ...s, [preset]: { ...s[preset], ...patch } }));
    touched();
  };
  const c = cs2[preset];
  const r = rl[preset];

  return (
    <Panel>
      <Tabs defaultValue="cs2">
        <TabsList className="px-2">
          <TabsTrigger value="cs2">Counter-Strike 2</TabsTrigger>
          <TabsTrigger value="rl">Rocket League</TabsTrigger>
          <TabsTrigger value="add" className="text-ink-3">
            + Add a game
          </TabsTrigger>
        </TabsList>

        <PanelBar>
          <Segmented
            aria-label="Preset"
            value={preset}
            onValueChange={(v) => setPreset(v as Preset)}
            options={PRESETS}
            size="sm"
          />
          <span className="ml-auto">
            <Status state={sync} />
          </span>
        </PanelBar>

        <TabsContent value="cs2" className="pb-2 outline-none">
          <Group>Mouse</Group>
          <Row label="Sensitivity">
            <Stepper
              value={fmt(c.sens, 2)}
              onDown={() => editCs2({ sens: Math.max(0.1, +(c.sens - 0.05).toFixed(2)) })}
              onUp={() => editCs2({ sens: +(c.sens + 0.05).toFixed(2) })}
              label="Sensitivity"
            />
          </Row>
          <Row label="DPI">
            <Val>{c.dpi}</Val>
          </Row>
          <Row label="Raw input">
            <Segmented
              aria-label="Raw input"
              size="sm"
              value={c.raw}
              onValueChange={(v) => editCs2({ raw: v as "On" | "Off" })}
              options={[
                { label: "On", value: "On" },
                { label: "Off", value: "Off" },
              ]}
            />
          </Row>
          <Group>Video</Group>
          <Row label="Resolution">
            <Cycle
              label="Resolution"
              value={RESOLUTIONS[c.res]!}
              onNext={() => editCs2({ res: (c.res + 1) % RESOLUTIONS.length })}
            />
          </Row>
          <Row label="Refresh rate">
            <Segmented
              aria-label="Refresh rate"
              size="sm"
              value={String(c.hz)}
              onValueChange={(v) => editCs2({ hz: Number(v) as 144 | 240 })}
              options={[
                { label: "144 Hz", value: "144" },
                { label: "240 Hz", value: "240" },
              ]}
            />
          </Row>
          <Group>Keys</Group>
          <Row label="Jump">
            <Key>Space</Key>
            <Key>Mouse 4</Key>
          </Row>
        </TabsContent>

        <TabsContent value="rl" className="pb-2 outline-none">
          <Group>Camera</Group>
          <Row label="Field of view">
            <Val>{r.fov}</Val>
          </Row>
          <Row label="Distance">
            <Stepper
              label="Distance"
              value={String(r.distance)}
              onDown={() => editRl({ distance: r.distance - 10 })}
              onUp={() => editRl({ distance: r.distance + 10 })}
            />
          </Row>
          <Row label="Height">
            <Val>{r.height}</Val>
          </Row>
          <Row label="Stiffness">
            <Stepper
              label="Stiffness"
              value={fmt(r.stiffness, 2)}
              onDown={() => editRl({ stiffness: Math.max(0, +(r.stiffness - 0.05).toFixed(2)) })}
              onUp={() => editRl({ stiffness: Math.min(1, +(r.stiffness + 0.05).toFixed(2)) })}
            />
          </Row>
          <Row label="Angle">
            <Val>{fmt(r.angle, 1)}</Val>
          </Row>
          <Row label="Controller deadzone">
            <Val>{fmt(r.deadzone, 2)}</Val>
          </Row>
          <Group>Controls</Group>
          <Row label="Powerslide">
            <Key>Shift</Key>
          </Row>
        </TabsContent>

        <TabsContent value="add" className="outline-none">
          <div className="px-4 py-10 text-[15px] text-ink-2">
            Name the game, add the categories its menu has, and type the values — or let the
            companion read its config files. Nothing here is hard-coded to a title.
          </div>
        </TabsContent>
      </Tabs>
    </Panel>
  );
}

/** ◂ value ▸ — the stepper the app uses for numbers with a step. */
function Stepper({
  value,
  onDown,
  onUp,
  label,
}: {
  value: string;
  onDown: () => void;
  onUp: () => void;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <IconButton onClick={onDown} label={`Decrease ${label}`}>
        <ChevronLeft />
      </IconButton>
      <Val className="min-w-12 text-center">{value}</Val>
      <IconButton onClick={onUp} label={`Increase ${label}`}>
        <ChevronRight />
      </IconButton>
    </span>
  );
}

/** A dropdown-looking value that cycles on click (keeps the demo dependency-free). */
function Cycle({ value, onNext, label }: { value: string; onNext: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onNext}
      aria-label={`${label}: ${value}. Change`}
      className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm border border-line bg-raised px-2.5 text-ink hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <Val>{value}</Val>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-ink-3">
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

function IconButton({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex size-8 cursor-pointer items-center justify-center rounded-sm border border-line bg-raised text-ink-2 hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </button>
  );
}
