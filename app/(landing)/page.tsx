import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { SITE } from "@/lib/site";
import { getSession } from "@/lib/auth/session";
import { FEATURES, FOUNDER, PRICES } from "@/lib/billing/public";
import { LIMITS } from "@/lib/billing/limits";
import { founderCode, founderOfferEnabled } from "@/lib/env";
import { LogoMark } from "@/components/app/logo";
import { MarketingFooter } from "@/components/marketing/chrome";
import { CookieNotice } from "@/components/marketing/cookie-notice";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { StructuredData } from "@/components/marketing/structured-data";
import { FileSync } from "@/components/landing/file-sync";
import { PresetFiles } from "@/components/landing/preset-files";
import s from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "ConfigSync — Sync, back up and share your game settings on every PC" },
  description:
    "Store, organise and compare the settings and config files you use for any PC game — CS2, Rocket League and more — then put the setup you want on any PC. Every save keeps a snapshot you can restore.",
  alternates: { canonical: "/" },
};

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** The companion's contract, each with the line it actually prints or keeps. */
const RULES = [
  {
    rule: "It never writes while the game is running.",
    proof: "cs2.exe is running. Nothing written.",
  },
  {
    rule: "It copies the file before it changes it.",
    proof: "cs2_user_convars_0_slot0.vcfg.bak-2026-09-24T19-42-03-114Z",
  },
  {
    rule: "Only the app on your PC touches your game files.",
    proof: "The site stores your settings. Reading and writing files happens on your PC.",
  },
  {
    rule: "Nothing on this site follows you around.",
    proof: "No analytics, no trackers. Export everything you stored, any time.",
  },
];

const HISTORY = [
  { when: "Today 19:42", what: "Mouse Sensitivity", from: "1.85", to: "2.40", restore: true },
  { when: "Yesterday 21:13", what: "Crosshair Size", from: "2", to: "3", restore: true },
  { when: "18 Sep 22:05", what: "Resolution", from: "1280×720", to: "1920×1080", restore: true },
  { when: "14 Sep 18:31", what: "Preset created", from: null, to: null, restore: false },
];

const GAMES = [
  {
    href: "/for/cs2",
    name: "Counter-Strike 2",
    what: "From keyboard and mouse to crosshair, in the game's real menu.",
    files: [
      "cs2_user_convars_0_slot0.vcfg",
      "cs2_user_keys_0_slot0.vcfg",
      "cs2_machine_convars.vcfg",
      "cs2_video.txt",
    ],
  },
  {
    href: "/for/rocket-league",
    name: "Rocket League",
    what: "Camera, controls and video, in the game's real menu.",
    files: ["TAInput.ini", "TASystemSettings.ini"],
  },
];

/** Landing page. Signed-in users go straight to the app. */
export default async function LandingPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <>
      <StructuredData />
      {/* Everyone here is signed out — signed-in visitors were redirected to /dashboard above. */}
      <CookieNotice />
      {founderCode ? <FounderOffer code={founderCode} /> : null}
      <div className={s.root}>
        <div aria-hidden className={s.light} />

        <header className={s.header}>
          <Link href="/" className={s.brand} aria-label="ConfigSync home">
            <LogoMark size={26} />
            <span>ConfigSync</span>
          </Link>
          <nav aria-label="Primary" className={s.nav}>
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#games">Games</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className={s.headerRight}>
            <Link href="/sign-in" className={s.quiet}>
              Sign in
            </Link>
            <Link href="/sign-up" className={cx(s.btn, s.btnGhost)}>
              Create a free account
            </Link>
          </div>
        </header>

        <main id="top">
          {/* Hero: the mechanism, acted out on the real file. */}
          <section className={s.hero}>
            <div className={s.heroText}>
              <h1 className={s.h1}>Your setup, written into the game on every PC.</h1>
              <div className={s.heroSide}>
                <p className={s.lead}>
                  Keep your game settings in one place. The companion writes them into each
                  PC&apos;s own config files, backing them up first.
                </p>
                <div className={s.actions}>
                  <a href={SITE.windowsApp} download className={cx(s.btn, s.btnPrimary)}>
                    <Download aria-hidden className={s.icon} /> Download for Windows
                  </a>
                  <Link href="/sign-up" className={cx(s.btn, s.btnGhost)}>
                    Create a free account
                  </Link>
                </div>
              </div>
            </div>
            <FileSync />
          </section>

          {/* The contract. */}
          <section id="how" className={s.section}>
            <h2 className={s.h2}>Four rules it doesn&apos;t break</h2>
            <ol className={s.rules}>
              {RULES.map((r) => (
                <li key={r.rule} className={s.rule}>
                  <p className={s.ruleText}>{r.rule}</p>
                  <p className={cx(s.ruleProof, s.mono)}>{r.proof}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Presets + compare. */}
          <section id="product" className={cx(s.section, s.split)}>
            <div className={s.copy}>
              <h2 className={s.h2}>A preset for every setup</h2>
              <p className={s.body}>
                The one you play ranked on, the one the laptop can run, the one you&apos;re still
                testing. Pick one to see exactly which lines of the file it changes.
              </p>
              <p className={s.small}>Use the arrow keys, or click a preset.</p>
            </div>
            <PresetFiles />
          </section>

          {/* History. */}
          <section className={s.section}>
            <div className={s.copy}>
              <h2 className={s.h2}>Try something. Go back if it was worse.</h2>
              <p className={s.body}>
                Every save keeps a snapshot. Free keeps {LIMITS.free.revisions} per preset, Pro
                keeps all of them.
              </p>
            </div>
            <ol className={s.log} aria-label="History of the Competitive preset">
              {HISTORY.map((h) => (
                <li key={h.when} className={s.logRow}>
                  <span className={s.logWhen}>{h.when}</span>
                  <span className={s.logWhat}>
                    {h.what}
                    {h.from ? (
                      <>
                        {" "}
                        <del className={cx(s.old, s.mono)}>{h.from}</del>{" "}
                        <span className={cx(s.v, s.mono)}>{h.to}</span>
                      </>
                    ) : null}
                  </span>
                  {h.restore ? <span className={s.logAction}>Restore</span> : null}
                </li>
              ))}
            </ol>
          </section>

          {/* Games. */}
          <section id="games" className={s.section}>
            <h2 className={s.h2}>The games it knows, file by file</h2>
            <div className={s.games}>
              {GAMES.map((g) => (
                <Link key={g.href} href={g.href} className={s.game}>
                  <span className={s.gameName}>{g.name}</span>
                  <span className={s.gameWhat}>{g.what}</span>
                  <span className={s.gameFiles}>
                    {g.files.map((f) => (
                      <code key={f}>{f}</code>
                    ))}
                  </span>
                </Link>
              ))}
              <div className={cx(s.game, s.gameOther)}>
                <span className={s.gameName}>Any other game</span>
                <span className={s.gameWhat}>
                  Add it, name the settings you care about, keep presets and history the same way.
                  These are stored and compared on the site; no files are written.
                </span>
              </div>
            </div>
          </section>

          {/* The Windows app. */}
          <section id="desktop" className={cx(s.section, s.split, s.splitFlip)}>
            <div className={s.copy}>
              <h2 className={s.h2}>ConfigSync for Windows</h2>
              <p className={s.body}>
                Install it and paste a token from Settings → Companion. It shows which of your games
                this PC has and which preset each should run, and applies or imports with one click.
              </p>
              <a href={SITE.windowsApp} download className={cx(s.btn, s.btnPrimary)}>
                <Download aria-hidden className={s.icon} /> Download for Windows
              </a>
              <p className={s.small}>Windows 10 and 11.</p>
            </div>
            <div className={s.window} aria-label="The ConfigSync window on win-01" role="img">
              <div className={s.windowBar}>
                <LogoMark size={16} />
                <span>ConfigSync</span>
                <span className={s.windowHost}>win-01</span>
              </div>
              <div className={s.appRow}>
                <div>
                  <p className={s.appGame}>Counter-Strike 2</p>
                  <p className={s.appMeta}>4 files · Competitive · applied today at 19:42</p>
                </div>
                <span className={s.appBtns}>
                  <span className={s.appBtn}>Import</span>
                  <span className={cx(s.appBtn, s.appBtnOn)}>Apply</span>
                </span>
              </div>
              <div className={s.appRow}>
                <div>
                  <p className={s.appGame}>Rocket League</p>
                  <p className={s.appMeta}>
                    2 files · Main · applied 21 Sep at 09:05 ·{" "}
                    <span className={s.appStale}>out of date</span>
                  </p>
                </div>
                <span className={s.appBtns}>
                  <span className={s.appBtn}>Import</span>
                  <span className={cx(s.appBtn, s.appBtnOn)}>Apply</span>
                </span>
              </div>
              <p className={s.appMsg}>Wrote 1 file, backed up first</p>
            </div>
          </section>

          {/* Pricing. */}
          <section id="pricing" className={s.section}>
            <h2 className={s.h2}>Free does the job. Pro does it for you.</h2>
            <div className={s.plans}>
              <div className={s.plan}>
                <h3 className={s.planName}>Free</h3>
                <p className={s.price}>0 €</p>
                <ul className={s.features}>
                  {FEATURES.free.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link href="/sign-up" className={cx(s.btn, s.btnGhost)}>
                  Create a free account
                </Link>
              </div>
              <div id="pro" className={cx(s.plan, s.planPro)}>
                <h3 className={s.planName}>Pro</h3>
                <p className={s.price}>
                  {PRICES.monthlyAmount} <span className={s.priceNote}>a month, or </span>
                  {founderOfferEnabled ? (
                    <span className={s.priceNote}>
                      <strong className={s.founder}>{FOUNDER.lifetime}</strong> <s>{FOUNDER.was}</s>
                    </span>
                  ) : (
                    <span className={s.priceNote}>{PRICES.lifetime}</span>
                  )}
                </p>
                <ul className={s.features}>
                  {FEATURES.pro.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                  <li>Everything in Free</li>
                </ul>
                <Link href="/pricing" className={cx(s.btn, s.btnPrimary)}>
                  Go Pro
                </Link>
              </div>
            </div>
            <p className={s.small}>
              Paddle is the merchant of record and handles invoices, tax and refunds.
            </p>
          </section>

          {/* Close. */}
          <section className={s.close}>
            <h2 className={s.closeH}>Stop rebuilding your setup.</h2>
            <div className={s.actions}>
              <a href={SITE.windowsApp} download className={cx(s.btn, s.btnPrimary)}>
                <Download aria-hidden className={s.icon} /> Download for Windows
              </a>
              <Link href="/sign-up" className={cx(s.btn, s.btnGhost)}>
                Create a free account
              </Link>
            </div>
          </section>
        </main>
        <MarketingFooter />
      </div>
    </>
  );
}
