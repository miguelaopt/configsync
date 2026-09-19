import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SyncLabel } from "@/lib/data/dashboard";

/** A dashboard card: icon plate, title, one line of purpose, optional "view all" link. */
export function Panel({
  icon,
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      <header className="flex items-center gap-3 p-4 sm:p-5">
        {icon ? (
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text [&_svg]:size-5"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="text-[13px] text-ink-3">{subtitle}</p> : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="flex shrink-0 items-center gap-1.5 rounded-sm text-[13px] font-medium text-accent-text hover:text-ink"
          >
            {action.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </header>
      <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const SYNC_COPY: Record<SyncLabel, { label: string; tone: string }> = {
  synced: { label: "Synced", tone: "bg-good-soft text-good" },
  pending: { label: "Changes to apply", tone: "bg-accent-soft text-accent-text" },
  failed: { label: "Failed", tone: "bg-bad-soft text-bad" },
  never: { label: "Not applied", tone: "bg-raised text-ink-3" },
};

/** The pill every sync state is shown with — dot plus words, never colour alone. */
export function SyncPill({ status, className }: { status: SyncLabel; className?: string }) {
  const { label, tone } = SYNC_COPY[status];
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

/**
 * What is coming, as one panel of rows rather than a stack of cards. Three cards gave a quarter
 * of the dashboard to features that do not exist yet; three rows say the same in half the height.
 */
export function DiscoverPanel({
  items,
}: {
  items: { icon: React.ReactNode; title: string; description: string }[];
}) {
  return (
    <section className="panel flex flex-col" aria-labelledby="discover">
      <h2
        id="discover"
        className="px-5 pt-4 pb-3 text-[11px] font-semibold tracking-wide text-ink-3 uppercase"
      >
        Discover
      </h2>
      <ul className="flex flex-col">
        {items.map((i) => (
          <li key={i.title} className="flex items-start gap-3 border-t border-hairline px-5 py-3.5">
            <span aria-hidden className="mt-0.5 shrink-0 text-ink-3 [&_svg]:size-[18px]">
              {i.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-ink-2">{i.title}</span>
              <span className="mt-0.5 block text-[13px] text-ink-3">{i.description}</span>
            </span>
            <span className="mt-0.5 shrink-0 text-[12px] whitespace-nowrap text-ink-3">
              Coming soon
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A card for something that is designed but not built yet.
 * It describes what will be there — no fake avatars, no invented numbers.
 */
export function ComingSoonPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <section className="panel flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised text-ink-3 [&_svg]:size-5"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink-2">{title}</h2>
        </div>
        <span className="shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-3">
          Coming soon
        </span>
      </div>
      <p className="text-[13px] text-ink-3">{description}</p>
    </section>
  );
}
