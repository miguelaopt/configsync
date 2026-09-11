const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago" … */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["week", 604800],
    ["month", 2592000],
    ["year", 31536000],
  ];
  let unit: Intl.RelativeTimeFormatUnit = "minute";
  let value = diff / 60;
  for (let i = 0; i < units.length; i++) {
    const [u, secs] = units[i]!;
    const next = units[i + 1];
    if (!next || abs < next[1]) {
      unit = u;
      value = diff / secs;
      break;
    }
  }
  return rtf.format(Math.round(value), unit);
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export const PLATFORM_SUGGESTIONS = [
  "PC",
  "PlayStation 5",
  "Xbox Series X|S",
  "Nintendo Switch",
  "Steam Deck",
  "Mobile",
];
