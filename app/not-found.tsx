import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center px-4 sm:px-6">
        <Link href="/" aria-label="GameSettings Vault home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <p className="font-display text-6xl text-ink-3">404</p>
        <h1 className="mt-2 font-display text-2xl">Page not found</h1>
        <p className="mt-1 max-w-sm text-[13px] text-ink-2">
          The link may be old, or the page moved.
        </p>
        <div className="mt-6 flex gap-2">
          <Button asChild variant="primary">
            <Link href="/dashboard">Open the app</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
