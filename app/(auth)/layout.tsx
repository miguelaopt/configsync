import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { LegalLinks } from "@/components/marketing/legal";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center px-4 sm:px-6">
        <Link href="/" aria-label="ConfigSync home" className="rounded-sm">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="flex flex-col gap-2 px-4 py-6 text-center text-xs text-ink-3">
        <span>Source-available · self-hostable · your data stays yours.</span>
        <LegalLinks />
      </footer>
    </div>
  );
}
