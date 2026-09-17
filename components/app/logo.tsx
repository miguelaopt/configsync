import { cn } from "@/lib/utils/cn";

/** Wordmark: a vault-dial glyph + name. Original artwork, no game branding. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
        <rect x="2" y="2" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="5.25" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 6.75v3M12 14.25v3M6.75 12h3M14.25 12h3"
          stroke="var(--accent)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {!compact ? (
        <span className="font-display text-[17px] leading-none font-semibold tracking-tight">
          Config<span className="text-accent">Sync</span>
        </span>
      ) : null}
    </span>
  );
}
