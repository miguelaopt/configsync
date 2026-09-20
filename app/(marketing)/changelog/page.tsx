import type { Metadata } from "next";
import { CHANGELOG, type ChangeKind } from "@/content/changelog";

export const metadata: Metadata = {
  title: "Changelog — what's new in ConfigSync",
  description:
    "Every change to ConfigSync, newest first: new games, import and sync improvements, and fixes.",
  alternates: { canonical: "/changelog" },
};

const KIND: Record<ChangeKind, { label: string; tone: string }> = {
  new: { label: "New", tone: "bg-accent-soft text-accent-text" },
  improved: { label: "Improved", tone: "bg-good-soft text-good" },
  fixed: { label: "Fixed", tone: "bg-raised text-ink-2" },
};

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** One entry per release, from content/changelog.ts. */
export default function ChangelogPage() {
  return (
    <div className="flex flex-col gap-12">
      <header className="max-w-2xl">
        <h1 className="text-[40px] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[52px]">
          What&rsquo;s new
        </h1>
        <p className="mt-5 text-[16px] text-ink-2">
          Every change that reaches configsync.app, newest first. Dates are the day it went live.
        </p>
      </header>

      <ol className="flex flex-col gap-8">
        {CHANGELOG.map((entry) => (
          <li
            key={entry.date}
            id={entry.date}
            className="grid scroll-mt-28 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10"
          >
            <a
              href={`#${entry.date}`}
              className="w-fit rounded-sm text-[13px] text-ink-3 hover:text-ink lg:sticky lg:top-28 lg:self-start"
            >
              <time dateTime={entry.date}>{longDate(entry.date)}</time>
            </a>
            <article className="panel p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink">{entry.title}</h2>
                <code className="rounded-md bg-raised px-2 py-0.5 font-mono text-[12px] text-ink-2">
                  v{entry.version}
                </code>
              </div>
              <ul className="mt-4 flex flex-col gap-3">
                {entry.changes.map((c) => (
                  <li key={c.text} className="flex items-start gap-3 text-[14px] text-ink-2">
                    <span
                      className={`mt-0.5 inline-flex h-5 w-[72px] shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${KIND[c.kind].tone}`}
                    >
                      {KIND[c.kind].label}
                    </span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
