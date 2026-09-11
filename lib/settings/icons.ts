import {
  Accessibility,
  Camera,
  Cpu,
  Eye,
  Gamepad2,
  Gauge,
  Keyboard,
  LayoutGrid,
  Monitor,
  Mouse,
  Settings2,
  Shield,
  SlidersHorizontal,
  Volume2,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Curated icon set for categories. Stored by name so the DB never depends on the icon library. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  gamepad: Gamepad2,
  mouse: Mouse,
  keyboard: Keyboard,
  monitor: Monitor,
  eye: Eye,
  volume: Volume2,
  camera: Camera,
  wifi: Wifi,
  sliders: SlidersHorizontal,
  cpu: Cpu,
  gauge: Gauge,
  accessibility: Accessibility,
  layout: LayoutGrid,
  shield: Shield,
  zap: Zap,
  settings: Settings2,
};

/** Best-guess icon for common category names, used when the user doesn't pick one. */
export function guessIcon(name: string): string | null {
  const n = name.toLowerCase();
  const rules: [RegExp, string][] = [
    [/control|input|bind/, "gamepad"],
    [/mouse|aim|sens/, "mouse"],
    [/key/, "keyboard"],
    [/display|screen|video|resolution/, "monitor"],
    [/graphic|visual|render|quality/, "eye"],
    [/audio|sound|music|volume/, "volume"],
    [/camera|fov|view/, "camera"],
    [/network|online|connection|server/, "wifi"],
    [/perf|fps|frame/, "gauge"],
    [/access/, "accessibility"],
    [/hud|interface|ui|layout|overlay/, "layout"],
    [/advanced|debug|system/, "cpu"],
    [/gameplay|game/, "zap"],
  ];
  for (const [re, icon] of rules) if (re.test(n)) return icon;
  return null;
}
