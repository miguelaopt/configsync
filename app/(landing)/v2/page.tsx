import type { Metadata } from "next";
import Link from "next/link";
import { Archivo } from "next/font/google";
import { ArrowUpRight } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { CATALOG, getCatalogGame } from "@/lib/catalog";
import { CHANGELOG } from "@/content/changelog";
import { FEATURES, FOUNDER, PRICES } from "@/lib/billing/public";
import { LIMITS } from "@/lib/billing/limits";
import { founderOfferEnabled } from "@/lib/env";
import { LogoMark } from "@/components/app/logo";
import { MarketingFooter } from "@/components/marketing/chrome";
import { CookieNotice } from "@/components/marketing/cookie-notice";
import { Crosshair, XHAIR_START } from "@/components/landing-v2/crosshair";
import { HeroSync } from "@/components/landing-v2/hero-sync";
import { Reinstall } from "@/components/landing-v2/reinstall";
import { AppWindow } from "@/components/landing-v2/app-window";
import s from "./v2.module.css";

/** Wide display face for headlines only; everything else stays Geist / Geist Mono. */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-v2-display",
  display: "swap",
});

// ponytail: a side-by-side preview of the next landing page, kept out of search until it replaces /.
export const metadata: Metadata = {
  title: { absolute: "ConfigSync: Stop rebuilding your setup" },
  robots: { index: false, follow: false },
};

/** Settings a preset writes into the game's files, counted from the catalog so it stays true. */
function fileBacked(id: string) {
  const g = getCatalogGame(id);
  const settings = g?.presets[0]?.categories.flatMap((c) => c.settings) ?? [];
  return {
    settings: settings.filter((x) => x.source?.file).length,
    files: g?.files.length ?? 0,
  };
}

export default async function LandingV2() {
  const signedIn = Boolean(await getSession());
  const cs2 = fileBacked("cs2");
  const rl = fileBacked("rocket-league");

  return (
    <div className={`${s.root} ${display.variable}`}>
      <CookieNotice />
      <header className={s.header}>
        <Link href="/" className={s.brand} aria-label="ConfigSync home">
          <LogoMark size={26} />
          <span>ConfigSync</span>
        </Link>
        <nav aria-label="Primary" className={s.nav}>
          <a href="#product">Product</a>
          <a href="#how">How it works</a>
          <a href="#games">
            Games<sup>{CATALOG.length}</sup>
          </a>
          <a href="#pricing">Pricing</a>
          <Link href="/changelog">
            Changelog<sup>{CHANGELOG.length}</sup>
          </Link>
        </nav>
        <div className={s.headerRight}>
          {signedIn ? (
            <Link href="/dashboard" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}>
              Open the app
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className={s.quiet}>
                Sign in
              </Link>
              <Link href="/sign-up" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}>
                Create a free account
              </Link>
            </>
          )}
        </div>
      </header>

      <main>
        <HeroSync
          freeGames={LIMITS.free.games}
          dock={
            <>
              <div className={s.stat}>
                <p className={s.statNum}>0</p>
                <p className={s.statLabel}>trackers or analytics on this site</p>
              </div>
              <div className={s.stat}>
                <p className={s.statNum}>{cs2.settings}</p>
                <p className={s.statLabel}>
                  Counter-Strike 2 settings written by one <code>csync apply</code>
                </p>
              </div>
            </>
          }
        />

        <Reinstall />

        <section id="product" className={`${s.section} ${s.appSection}`}>
          <div className={s.appCopy}>
            <h2 className={s.h2}>Your whole setup, in one window.</h2>
            <p className={s.body}>
              Games, presets and the game&apos;s own settings. Compare two presets, or scrub back
              through every snapshot. Go on, click around.
            </p>
          </div>
          <AppWindow freeSnapshots={LIMITS.free.revisions} />
        </section>

        <section id="games" className={s.section}>
          <h2 className={s.h2}>Two real menus. Room for any game.</h2>
          <div className={s.games}>
            <Link href="/for/cs2" className={s.gameTile}>
              <span className={s.gameCode}>CS2</span>
              <span className={s.gameFoot}>
                <span className={s.gameName}>Counter-Strike 2</span>
                <span className={s.gameMeta}>
                  <span>Real menu</span>
                  <span>
                    {cs2.files} config files · {cs2.settings} settings written
                  </span>
                </span>
              </span>
              <ArrowUpRight aria-hidden className={s.gameArrow} />
            </Link>
            <Link href="/for/rocket-league" className={s.gameTile}>
              <span className={s.gameCode}>RL</span>
              <span className={s.gameFoot}>
                <span className={s.gameName}>Rocket League</span>
                <span className={s.gameMeta}>
                  <span>Real menu</span>
                  <span>
                    {rl.files} config files · {rl.settings} settings written
                  </span>
                </span>
              </span>
              <ArrowUpRight aria-hidden className={s.gameArrow} />
            </Link>
            <Link href="/sign-up" className={`${s.gameTile} ${s.gameAny}`}>
              <span className={s.gameAnyCode}>+ Any game</span>
              <span className={s.gameAnyText}>
                Add it, name the settings you care about, keep presets and history the same way.
              </span>
              <ArrowUpRight aria-hidden className={s.gameArrow} />
            </Link>
          </div>
        </section>

        <section className={`${s.section} ${s.privacy}`} aria-labelledby="privacy-title">
          <h2 id="privacy-title" className={s.privacyH}>
            Settings.
            <br />
            Nothing else.
          </h2>
          <ul className={s.privacyList}>
            <li>
              <strong>No analytics, no trackers.</strong> Signed out, this site sets no cookies.
            </li>
            <li>
              <strong>Only the companion touches files,</strong> on your PC, and it copies them
              before it writes.
            </li>
            <li>
              <strong>Export everything, any time,</strong> as text, Markdown, CSV or JSON.
            </li>
          </ul>
        </section>

        <section id="pricing" className={s.section}>
          <div className={s.priceHead}>
            <h2 className={s.h2}>Free does the job. Pro does it for you.</h2>
            <span className={s.badge}>Desktop app: coming soon</span>
          </div>
          <div className={s.plans}>
            <div className={s.plan}>
              <h3 className={s.planName}>Free</h3>
              <p className={s.price}>0 €</p>
              <p className={s.priceNote}>For as long as you like.</p>
              <ul className={s.features}>
                {FEATURES.free.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link href="/sign-up" className={`${s.btn} ${s.btnGhost}`}>
                Create a free account
              </Link>
            </div>
            <div id="pro" className={`${s.plan} ${s.planPro}`}>
              <h3 className={s.planName}>Pro</h3>
              <p className={s.price}>
                {PRICES.monthlyAmount}
                <span className={s.per}> / month</span>
              </p>
              {founderOfferEnabled ? (
                <p className={s.priceNote}>
                  or <strong className={s.launch}>{FOUNDER.amount} once</strong>, the launch price.
                  Normally <s>{FOUNDER.was}</s>.
                </p>
              ) : (
                <p className={s.priceNote}>or {PRICES.lifetime}.</p>
              )}
              <ul className={s.features}>
                {FEATURES.pro.map((f) => (
                  <li key={f}>{f}</li>
                ))}
                <li>Everything in Free</li>
              </ul>
              <Link href="/pricing" className={`${s.btn} ${s.btnPrimary}`}>
                Go Pro
              </Link>
            </div>
          </div>
          <p className={s.merchant}>
            Paddle is the merchant of record and handles invoices, tax and refunds.
          </p>
        </section>

        <section className={s.final} aria-labelledby="final-title">
          <div aria-hidden className={s.bloom} />
          <h2 id="final-title" className={s.finalH}>
            Save it once.
            <br />
            Play anywhere.
          </h2>
          <div className={s.miniRig} aria-hidden>
            <MiniMachine host="win-01" />
            <span className={s.miniLink}>
              <span className={s.node} />
              <span className={s.miniTrack} />
              <span className={s.node} />
            </span>
            <MiniMachine host="thinkpad-x1" />
          </div>
          <Link href="/sign-up" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}>
            Create a free account
          </Link>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function MiniMachine({ host }: { host: string }) {
  return (
    <span className={s.mini}>
      <span className={s.miniBar}>
        <span>{host}</span>
        <span className={s.miniSynced}>Synced</span>
      </span>
      <span className={s.miniScreen}>
        <Crosshair x={XHAIR_START} className={s.miniX} />
      </span>
    </span>
  );
}
