import { getSession } from "@/lib/auth/session";
import { getPlan } from "@/lib/billing/plan";
import { founderCode } from "@/lib/env";
import { Backdrop, MarketingFooter, MarketingHeader } from "@/components/marketing/chrome";
import { CookieNotice } from "@/components/marketing/cookie-notice";
import { FounderOffer } from "@/components/marketing/founder-offer";

/** Public pages outside the landing: the same chrome, so the brand does not change mid-visit. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Nobody who already paid should be offered a discount on what they own.
  const isPro = session ? (await getPlan(session.user.id)).plan === "pro" : false;
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
      <CookieNotice />
      {founderCode && !isPro ? <FounderOffer code={founderCode} /> : null}
    </div>
  );
}
