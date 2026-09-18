import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/app/logo";
import { LegalLinks } from "@/components/marketing/legal";
import { AuthSwitchLink } from "@/components/auth/auth-switch";

/** Auth pages on the Nocturne stage: dot grid, top glow, minimal header, one centred card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="nocturne relative flex min-h-dvh flex-col overflow-x-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(233_233_237/0.045)_1px,transparent_1px)] [mask-image:linear-gradient(#000,transparent_900px)] [background-size:34px_34px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-340px] left-1/2 h-[900px] w-[1500px] -translate-x-1/2 [background:radial-gradient(closest-side,rgb(145_132_217/0.22),rgb(122_110_190/0.08)_48%,transparent_76%)]"
      />
      <header className="relative flex h-16 items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="ConfigSync home" className="rounded-sm">
          <Logo />
        </Link>
        <Suspense>
          <AuthSwitchLink />
        </Suspense>
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
        <div className="w-full max-w-[420px] rounded-[14px] border border-line-strong bg-[linear-gradient(#1c1f30,#171a29)] p-6 shadow-dialog sm:p-8">
          {children}
        </div>
      </main>
      <footer className="relative flex flex-col gap-2 px-4 py-6 text-center text-xs text-ink-3">
        <LegalLinks />
      </footer>
    </div>
  );
}
