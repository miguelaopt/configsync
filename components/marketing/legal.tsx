import * as React from "react";
import { LEGAL } from "@/lib/legal";

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Layout for /terms, /privacy and /refunds: title, date, a sticky table of contents built from
 * the Section children, then the sections themselves.
 */
export function LegalPage({
  title,
  intro,
  updated = LEGAL.updated,
  footer,
  children,
}: {
  title: string;
  intro: string;
  /** Shown under the title; null hides the line (docs pages). */
  updated?: string | null;
  /** Replaces the legal-entity block at the end; null removes it. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const sections = React.Children.toArray(children)
    .filter(
      (c): c is React.ReactElement<{ title: string }> =>
        React.isValidElement(c) && c.type === Section,
    )
    .map((c) => c.props.title);

  return (
    <article className="flex flex-col gap-10">
      <header className="max-w-3xl">
        <h1 className="text-[40px] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[48px]">
          {title}
        </h1>
        {updated ? <p className="mt-3 text-[13px] text-ink-3">Last updated {updated}</p> : null}
        <p className="mt-5 text-[16px] text-ink-2">{intro}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            On this page
          </h2>
          <ol className="mt-3 flex flex-col gap-2">
            {sections.map((s) => (
              <li key={s}>
                <a
                  href={`#${slug(s)}`}
                  className="block rounded-sm text-[13px] text-ink-3 transition-colors hover:text-ink"
                >
                  {s}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex max-w-[68ch] flex-col gap-8 text-[15px] leading-[1.7] text-ink-2">
          {children}
          {footer === undefined ? (
            <footer className="panel flex flex-col gap-1 p-5 text-[13px] text-ink-3">
              <span className="font-medium text-ink">
                {LEGAL.brand} — {LEGAL.place}
              </span>
              <a href={`mailto:${LEGAL.email}`} className="w-fit text-accent-text hover:text-ink">
                {LEGAL.email}
              </a>
              <span className="mt-2">
                Questions about this page? Write to us — a person reads that address. Our full
                business details are on the{" "}
                <a href="/contact" className="text-accent-text hover:text-ink">
                  contact page
                </a>
                .
              </span>
            </footer>
          ) : (
            footer
          )}
        </div>
      </div>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section id={slug(title)} className="flex scroll-mt-28 flex-col gap-3">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </section>
  );
}
