import { cn } from "@/lib/utils/cn";

/**
 * The landing page's one visual idea: the app's own options-menu grammar, reused at every
 * scale. Presentational only — no state — so it can render inside server components.
 */

/** Widens a block past the layout's text column, up to 1040 px, without breaking the page grid. */
export function Breakout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative left-1/2 w-[min(1040px,100vw-2rem)] -translate-x-1/2 sm:w-[min(1040px,100vw-3rem)]",
        className,
      )}
      {...props}
    />
  );
}

/** A menu panel: the app's ground colour on the darker stage, one hairline border. */
export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("overflow-hidden rounded-md border border-line bg-ground text-ink", className)}
      {...props}
    />
  );
}

/** Top bar of a panel: tabs / preset names on the left, a status on the right. */
export function PanelBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2",
        className,
      )}
      {...props}
    />
  );
}

/** Category heading inside a menu, set like the game would set it. */
export function Group({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "px-4 pt-4 pb-1 font-display text-[13px] font-medium tracking-wide text-ink-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One setting row: label left, control right. `dim` marks rows that are identical in a compare. */
export function Row({
  label,
  children,
  dim,
  changed,
  className,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  dim?: boolean;
  changed?: boolean;
  className?: string;
}) {
  return (
    <div
      data-active={changed || undefined}
      className={cn(
        "menu-row flex items-center justify-between gap-4 px-4",
        dim && "text-ink-3",
        className,
      )}
    >
      <span className={cn("font-display text-[16px] font-medium", dim ? "text-ink-3" : "text-ink")}>
        {label}
      </span>
      <span className="flex min-w-0 shrink-0 items-center gap-2">{children}</span>
    </div>
  );
}

/** A value with an optional unit, in mono like the game shows it. */
export function Val({
  children,
  unit,
  className,
}: {
  children: React.ReactNode;
  unit?: string;
  className?: string;
}) {
  return (
    <span className={cn("font-mono text-[15px] tabular-nums", className)}>
      {children}
      {unit ? <span className="ml-1 text-ink-3">{unit}</span> : null}
    </span>
  );
}

/** A keycap, as on a keybind row. */
export function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-7 min-w-7 items-center justify-center rounded-xs border border-line-strong bg-raised px-2 font-mono text-[13px] text-ink shadow-[inset_0_-1px_0_var(--line-strong)]">
      {children}
    </kbd>
  );
}

/** Two-state choice rendered statically (the hero uses the real Segmented control). */
export function Choice({ options, value }: { options: string[]; value: string }) {
  return (
    <span className="inline-flex rounded-sm border border-line bg-ground p-0.5">
      {options.map((o) => (
        <span
          key={o}
          className={cn(
            "rounded-xs px-2.5 text-[13px] leading-7",
            o === value
              ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]"
              : "text-ink-3",
          )}
        >
          {o}
        </span>
      ))}
    </span>
  );
}

export type SyncState = "synced" | "unsynced" | "syncing";

/** Sync status as the app shows it: a dot and plain words. */
export function Status({ state, pcs = 2 }: { state: SyncState; pcs?: number }) {
  const text =
    state === "synced"
      ? `Synced on ${pcs} PCs`
      : state === "syncing"
        ? "Syncing"
        : "1 unsynced change";
  return (
    <span
      className="inline-flex items-center gap-2 text-[13px] text-ink-2 motion-safe:transition-colors motion-safe:duration-300"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full motion-safe:transition-colors motion-safe:duration-300",
          state === "synced" && "bg-good",
          state === "syncing" && "bg-accent motion-safe:animate-pulse",
          state === "unsynced" && "bg-ink-3",
        )}
      />
      {text}
    </span>
  );
}

/** Small action as it appears on a row (Restore, Duplicate…): text, no chrome until hover. */
export function RowAction({
  children,
  className,
}: {
  children: React.ReactNode;
  /** `hidden sm:inline-flex` hides secondary actions on phones, as the app does. */
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-xs px-2 text-[13px] leading-7 whitespace-nowrap text-ink-2 ring-1 ring-line ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}
