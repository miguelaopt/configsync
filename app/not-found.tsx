import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { Backdrop, MarketingFooter, MarketingHeader } from "@/components/marketing/chrome";
import { Button } from "@/components/ui/button";

/** Any URL outside the app that does not exist. Same chrome as the marketing pages. */
export default async function RootNotFound() {
  const session = await getSession();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-ground">
      <Backdrop />
      <MarketingHeader signedIn={Boolean(session)} />
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-[96px] leading-none font-bold tracking-[-0.04em] text-accent-text/60">
          404
        </p>
        <h1 className="mt-4 text-[28px] font-bold tracking-[-0.02em]">Page not found</h1>
        <p className="mt-2 max-w-sm text-[15px] text-ink-2">
          The link may be old, or the page moved.
        </p>
        <div className="mt-8 flex gap-2">
          <Button asChild variant="primary" size="lg">
            <Link href={session ? "/dashboard" : "/"}>{session ? "Open the app" : "Home"}</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/pricing">Pricing</Link>
          </Button>
        </div>
      </main>
      <div className="relative">
        <MarketingFooter />
      </div>
    </div>
  );
}
