import { getSession } from "@/lib/auth/session";
import { Backdrop, MarketingFooter, MarketingHeader } from "@/components/marketing/chrome";

/** Public pages outside the landing: the same chrome, so the brand does not change mid-visit. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-ground">
      <Backdrop />
      <MarketingHeader signedIn={Boolean(session)} />
      <main className="relative flex-1 px-4 pt-12 pb-8 sm:px-6 sm:pt-16">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
      <div className="relative">
        <MarketingFooter />
      </div>
    </div>
  );
}
