import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/app/logo";

/**
 * Auth pages: split screen. Left — brand backdrop and tagline. Right — the form on the
 * plain Nocturne ground. Below lg the left panel is gone and a small brand row takes its place.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#0c0d14] lg:block">
        {/* A pre-sized WebP (80 KB), served as is: the production image has no sharp, and the
            optimizer hung on this 4 MB PNG once its cache was empty, leaving the panel blank. */}
        <Image
          src="/brand/auth-backdrop.webp"
          alt=""
          fill
          unoptimized
          loading="eager"
          className="object-cover"
        />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Link href="/" aria-label="ConfigSync home" className="w-fit rounded-sm">
            <Logo size={30} className="text-[20px]" />
          </Link>
          <p className="font-display text-[clamp(40px,4.2vw,64px)] leading-[1.05] font-medium tracking-[-0.03em] text-ink">
            Your game settings.
            <br />
            <span className="text-brand">Everywhere</span>
            <span className="text-accent">_</span>
          </p>
        </div>
      </aside>
      <div className="relative flex min-h-dvh flex-col">
        <header className="flex h-16 items-center px-6 lg:hidden">
          <Link href="/" aria-label="ConfigSync home" className="rounded-sm">
            <Logo />
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center px-6 py-8 sm:items-center sm:py-12">
          <div className="w-full max-w-[560px]">{children}</div>
        </main>
        <footer className="flex justify-center gap-4 px-6 py-6 text-xs text-ink-3">
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <a href="mailto:hello@configsync.app" className="hover:text-ink">
            Contact
          </a>
        </footer>
      </div>
    </div>
  );
}
