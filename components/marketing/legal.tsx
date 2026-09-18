import Link from "next/link";
import { LEGAL } from "@/lib/legal";

/** Layout for /terms, /privacy and /refunds: title, date, then plain sections. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-6 text-[14px] leading-relaxed text-ink-2">
      <header>
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        <p className="mt-1 text-xs text-ink-3">Last updated {LEGAL.updated}</p>
        <p className="mt-3">{intro}</p>
      </header>
      {children}
      <footer className="border-t border-line pt-4 text-xs text-ink-3">
        {LEGAL.operator}
        {LEGAL.taxId ? ` · ${LEGAL.taxId}` : ""} · {LEGAL.address} ·{" "}
        <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-4">
          {LEGAL.email}
        </a>
      </footer>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Footer links shown on every public and auth page (Paddle checks they are reachable). */
export function LegalLinks() {
  return (
    <nav className="flex justify-center gap-4">
      <Link href="/terms" className="hover:text-ink">
        Terms
      </Link>
      <Link href="/privacy" className="hover:text-ink">
        Privacy
      </Link>
      <Link href="/refunds" className="hover:text-ink">
        Refunds
      </Link>
      <a href={`mailto:${LEGAL.email}`} className="hover:text-ink">
        Contact
      </a>
    </nav>
  );
}
