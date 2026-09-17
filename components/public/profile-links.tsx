import { Code, Globe, MessageCircle, Tv, Video } from "lucide-react";
import { linkMeta, type LinkIcon } from "@/lib/public/links";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.9 2H22l-7.4 8.5L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.9-9L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" />
    </svg>
  );
}

const ICONS: Record<LinkIcon, React.ComponentType<{ className?: string }>> = {
  twitch: Tv,
  youtube: Video,
  x: XIcon,
  discord: MessageCircle,
  github: Code,
  globe: Globe,
};

/** Social links on a public profile. Only https URLs reach this component. */
export function ProfileLinks({ links }: { links: string[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((url) => {
        const { icon, label } = linkMeta(url);
        const Icon = ICONS[icon];
        return (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line px-2.5 text-[13px] text-ink-2 hover:border-line-strong hover:text-ink"
            >
              <Icon className="size-4" /> {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
