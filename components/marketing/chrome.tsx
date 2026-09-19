import Link from "next/link";
import { Logo, LogoMark } from "@/components/app/logo";
import { LEGAL } from "@/lib/legal";

/** The landing page's backdrop — dot grid fading out, one glow behind the header. */
export function Backdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgb(233 233 237 / 0.045) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "linear-gradient(#000, transparent 900px)",
          WebkitMaskImage: "linear-gradient(#000, transparent 900px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-340px] left-1/2 h-[720px] w-[1400px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgb(145 132 217 / 0.2), rgb(122 110 190 / 0.07) 48%, transparent 76%)",
        }}
      />
    </>
  );
}

const NAV = [
  { href: "/#product", label: "Product" },
  { href: "/#how", label: "How it works" },
  { href: "/#games", label: "Games" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 rounded-2xl border border-line bg-surface/80 px-4 backdrop-blur-md sm:px-6">
        <Link href="/" className="rounded-sm text-ink" aria-label="ConfigSync home">
          <Logo size={28} className="text-[19px]" />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-sm text-[14px] text-ink-2 transition-colors hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-[linear-gradient(180deg,#6f61ba,#524889)] px-4 py-2.5 text-[14px] font-medium text-accent-ink ring-1 ring-[rgb(181_171_252/0.5)] transition-transform hover:-translate-y-px"
            >
              Open the app
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-sm px-2 text-[14px] text-ink-2 transition-colors hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-xl bg-[linear-gradient(180deg,#6f61ba,#524889)] px-4 py-2.5 text-[14px] font-medium text-accent-ink ring-1 ring-[rgb(181_171_252/0.5)] transition-transform hover:-translate-y-px"
              >
                Create a free account
              </Link>
            </>
          )}
        </div>
      </header>
    </div>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "What it does" },
      { href: "/#how", label: "How it works" },
      { href: "/#games", label: "Games" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refunds", label: "Refund Policy" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-up", label: "Create a free account" },
      { href: "/sign-in", label: "Sign in" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="w-fit rounded-sm text-ink" aria-label="ConfigSync home">
            <Logo size={26} className="text-[18px]" />
          </Link>
          <p className="max-w-64 text-[13px] text-ink-3">
            Your game settings, saved once and put on every PC you play on.
          </p>
          <a
            href={`mailto:${LEGAL.email}`}
            className="w-fit text-[13px] text-accent-text hover:text-ink"
          >
            {LEGAL.email}
          </a>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
            <h2 className="text-[13px] font-semibold text-ink">{col.title}</h2>
            {col.links.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="w-fit rounded-sm text-[13px] text-ink-3 transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t border-line px-4 py-6 text-[12px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2">
          <LogoMark size={16} />
          {LEGAL.operator}
          {LEGAL.taxId ? ` · ${LEGAL.taxId}` : ""} · {LEGAL.address}
        </p>
        <p>Payments handled by {LEGAL.merchant}, our merchant of record.</p>
      </div>
    </footer>
  );
}
