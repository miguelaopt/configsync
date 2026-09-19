import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The brand lockup: interlocking sync mark + wordmark.
 * Artwork from ConfigSync-brand-assets/configsync-mark.svg — the one place it is drawn.
 * `size` scales the mark; the wordmark follows the surrounding font-size.
 */
export function Logo({
  className,
  compact = false,
  size = 24,
}: {
  className?: string;
  compact?: boolean;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {!compact ? (
        <span className="font-display text-[17px] leading-none font-semibold tracking-[-0.02em]">
          Config<span className="text-accent-text">Sync</span>
        </span>
      ) : null}
    </span>
  );
}

/** The mark on its own, for favicons-in-page, empty states and the auth panel. */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  // Unique per instance: two gradients with the same id on one page would cross-reference.
  const id = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B7A6FF" />
          <stop offset="48%" stopColor="#9184D9" />
          <stop offset="100%" stopColor="#6F5AC9" />
        </linearGradient>
      </defs>
      <path
        d="M55 16 L29 31 Q24 34 24 40 L24 51 Q24 56 29 59 L43 67 L54 58 L38 49 Q36 48 36 45 L36 41 Q36 38 39 36 L63 22 Z"
        fill={`url(#${id})`}
      />
      <path
        d="M45 84 L71 69 Q76 66 76 60 L76 49 Q76 44 71 41 L57 33 L46 42 L62 51 Q64 52 64 55 L64 59 Q64 62 61 64 L37 78 Z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}
