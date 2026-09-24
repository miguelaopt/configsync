import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Archivo } from "next/font/google";
import { ArrowUpRight } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { CATALOG, getCatalogGame } from "@/lib/catalog";
import { CHANGELOG } from "@/content/changelog";
import { FEATURES, FOUNDER, PRICES } from "@/lib/billing/public";
import { LIMITS } from "@/lib/billing/limits";
import { founderCode, founderOfferEnabled } from "@/lib/env";
import { LogoMark } from "@/components/app/logo";
import { MarketingFooter } from "@/components/marketing/chrome";
import { CookieNotice } from "@/components/marketing/cookie-notice";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { StructuredData } from "@/components/marketing/structured-data";
import { Crosshair, XHAIR_START } from "@/components/landing/crosshair";
import { HeroSync } from "@/components/landing/hero-sync";
import { Reinstall } from "@/components/landing/reinstall";
import { AppWindow } from "@/components/landing/app-window";
import { Scenes } from "@/components/landing/scenes";
import { GameTexture } from "@/components/landing/game-texture";
import s from "./landing.module.css";

/** Wide display face for headlines only; everything else stays Geist / Geist Mono. */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-landing-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { absolute: "ConfigSync — Sync, back up and share your game settings on every PC" },
  description:
    "Store, organise and compare the settings and config files you use for any PC game — CS2, Rocket League and more — then put the setup you want on any PC. Every save keeps a snapshot you can restore.",
  alternates: { canonical: "/" },
};

/** Settings a preset writes into the game's files, counted from the catalog so it stays true. */
function fileBacked(id: string) {
  const g = getCatalogGame(id);
  const settings = g?.presets[0]?.categories.flatMap((c) => c.settings) ?? [];
  return {
    settings: settings.filter((x) => x.source?.file).length,
    files: g?.files.length ?? 0,
    /** The game's own accent from the catalog, as its pages use it. */
    accent: g?.accentColor ?? "#9184d9",
  };
}

/** Landing page: "Two machines. One setup." Signed-in users go straight to the app. */
export default async function LandingPage() {
  if (await getSession()) redirect("/dashboard");
  const cs2 = fileBacked("cs2");
  const rl = fileBacked("rocket-league");

  return (
    <div className={`${s.root} ${display.variable}`}>
      <Scenes />
      <StructuredData />
      {/* Everyone here is signed out — signed-in visitors were redirected to /dashboard above. */}
      <CookieNotice />
      {founderCode ? <FounderOffer code={founderCode} /> : null}
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
          <Link href="/sign-in" className={s.quiet}>
            Sign in
          </Link>
          <Link href="/sign-up" className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}>
            Create a free account
          </Link>
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

        <section id="windows" className={`${s.section} ${s.winSection}`} data-scene="windows">
          <div>
            <h2 className={s.h2}>Or one click, on Windows.</h2>
            <p className={s.body}>
              ConfigSync for Windows runs the companion for you. It shows which of your games this
              PC has and which preset each should run, then applies or imports with one click. Same
              backups, same rule: nothing is written while the game is running.
            </p>
            <div className={s.winActions}>
              <Link href="/sign-up" className={`${s.btn} ${s.btnPrimary}`}>
                Create a free account
              </Link>
              <span className={`${s.mono} ${s.dim} ${s.fileMeta}`}>
                Download it from your dashboard after you sign up
              </span>
            </div>
          </div>
          <figure
            className={`${s.machine} ${s.winApp}`}
            data-tone="synced"
            role="img"
            aria-label="The ConfigSync window on win-01, listing Counter-Strike 2 and Rocket League with Import and Apply buttons"
          >
            <figcaption className={s.mBar}>
              <span className={s.winAppTitle}>
                <LogoMark size={16} /> ConfigSync
              </span>
              <span className={`${s.mono} ${s.dim}`}>win-01</span>
            </figcaption>
            <div className={s.winRow}>
              <div>
                <p className={s.winGame}>Counter-Strike 2</p>
                <p className={s.winMeta}>4 files · Competitive · applied today at 19:42</p>
              </div>
              <span className={s.winBtns}>
                <span className={s.winBtn}>Import</span>
                <span className={s.winBtn}>Apply</span>
              </span>
            </div>
            <div className={s.winRow}>
              <div>
                <p className={s.winGame}>Rocket League</p>
                <p className={s.winMeta}>
                  2 files · Main · applied 21 Sep at 09:05 ·{" "}
                  <span className={s.winStale}>out of date</span>
                </p>
              </div>
              <span className={s.winBtns}>
                <span className={s.winBtn}>Import</span>
                <span className={`${s.winBtn} ${s.winBtnOn}`}>Apply</span>
              </span>
            </div>
            <p className={s.winMsg}>Wrote 2 files, backed up first</p>
          </figure>
        </section>

        <section id="product" className={`${s.section} ${s.appSection}`} data-scene="app">
          <div className={s.appCopy}>
            <h2 className={s.h2}>Your whole setup, in one window.</h2>
            <p className={s.body}>
              Games, presets and the game&apos;s own settings. Compare two presets, or scrub back
              through every snapshot. Go on, click around.
            </p>
          </div>
          <AppWindow freeSnapshots={LIMITS.free.revisions} />
        </section>

        <section id="games" className={s.section} data-scene="games">
          <h2 className={s.h2}>Two real menus. Room for any game.</h2>
          <div className={s.games}>
            <Link
              href="/for/cs2"
              className={s.gameTile}
              style={{ "--game": cs2.accent } as React.CSSProperties}
            >
              <GameTexture game="cs2" />
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
            <Link
              href="/for/rocket-league"
              className={s.gameTile}
              style={{ "--game": rl.accent } as React.CSSProperties}
            >
              <GameTexture game="rl" />
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
              <GameTexture game="any" />
              <span className={s.gameAnyCode}>+ Any game</span>
              <span className={s.gameAnyText}>
                Add it, name the settings you care about, keep presets and history the same way.
              </span>
              <ArrowUpRight aria-hidden className={s.gameArrow} />
            </Link>
          </div>
        </section>

        <section
          className={`${s.section} ${s.privacy}`}
          aria-labelledby="privacy-title"
          data-scene="privacy"
        >
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
              <strong>Only the app on your PC touches files,</strong> and it copies them before it
              writes.
            </li>
            <li>
              <strong>Export everything, any time,</strong> as text, Markdown, CSV or JSON.
            </li>
          </ul>
        </section>

        <section id="pricing" className={s.section} data-scene="pricing">
          <div className={s.priceHead}>
            <h2 className={s.h2}>Free does the job. Pro does it for you.</h2>
            <span className={s.badge}>Windows app included on both plans</span>
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

        <section className={s.final} aria-labelledby="final-title" data-scene="final">
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
          <div className={s.finalActions}>
            <Link href="/sign-up" className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}>
              Create a free account
            </Link>
          </div>
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
