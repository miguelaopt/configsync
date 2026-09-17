export type LinkIcon = "twitch" | "youtube" | "x" | "discord" | "github" | "globe";

const HOSTS: [RegExp, LinkIcon, string][] = [
  [/(^|\.)twitch\.tv$/, "twitch", "Twitch"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube", "YouTube"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x", "X"],
  [/(^|\.)(discord\.gg|discord\.com)$/, "discord", "Discord"],
  [/(^|\.)github\.com$/, "github", "GitHub"],
];

/** Which icon and label to show for a profile link. Anything unknown is "globe" + its host. */
export function linkMeta(url: string): { icon: LinkIcon; label: string } {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { icon: "globe", label: url };
  }
  for (const [re, icon, label] of HOSTS) if (re.test(host)) return { icon, label };
  return { icon: "globe", label: host.replace(/^www\./, "") };
}
