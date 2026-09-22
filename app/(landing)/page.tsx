import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { FOUNDER, PRICES } from "@/lib/billing/public";
import { founderOfferEnabled } from "@/lib/env";
import { LogoMark } from "@/components/app/logo";
import { FounderOffer } from "@/components/marketing/founder-offer";
import { HeroCard, MotionProvider, Reveal, SyncCard } from "@/components/landing/motion";
import { StructuredData } from "@/components/marketing/structured-data";
import s from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "ConfigSync — Sync, back up and share your game settings on every PC" },
  description:
    "Store, organise and compare the settings and config files you use for any PC game — CS2, Rocket League and more — then put the setup you want on any PC. Every save keeps a snapshot you can restore.",
  alternates: { canonical: "/" },
};

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Landing page — port of "ConfigSync Landing v2". Signed-in users go straight to the app. */
export default async function LandingPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <MotionProvider>
      <StructuredData />
      {/* Everyone here is signed out — signed-in visitors were redirected to /dashboard above. */}
      {founderOfferEnabled ? <FounderOffer /> : null}
      <div className={s.root}>
        <div aria-hidden className={s.glowTop} />
        <div aria-hidden className={s.glowRight} />

        <div className={s.headerWrap}>
          <header className={s.header}>
            <a href="#top" className={s.brand}>
              <LogoMark size={28} />
              <span className={s.wordmark}>
                Config<span>Sync</span>
              </span>
            </a>
            <nav aria-label="Primary" className={s.nav}>
              <a href="#product" className={s.navlink}>
                Product
              </a>
              <a href="#how" className={s.navlink}>
                How it works
              </a>
              <a href="#games" className={s.navlink}>
                Games
              </a>
              <a href="#pricing" className={s.navlink}>
                Pricing
              </a>
            </nav>
            <div className={s.headerRight}>
              <Link href="/sign-in" className={s.signin}>
                Sign in
              </Link>
              <Link href="/sign-up" className={s.cta}>
                Create a free account
              </Link>
            </div>
          </header>
        </div>

        <main id="top" className={s.main}>
          {/* Hero */}
          <section className={s.hero}>
            <div className={s.heroGrid}>
              <Reveal as="div">
                <h1 className={s.h1}>
                  Your game settings.
                  <br />
                  <span className={s.gradText}>Everywhere.</span>
                </h1>
                <p className={s.heroLead}>
                  Store, organise and compare the settings you use for any game, then put the setup
                  you want on any PC. Every save keeps a snapshot, so you can experiment and go
                  back.
                </p>
                <div className={s.heroActions}>
                  <Link href="/sign-up" className={cx(s.cta, s.ctaLg)}>
                    Create a free account
                  </Link>
                  <Link href="/sign-in" className={s.ghost}>
                    Sign in
                  </Link>
                </div>
                <p className={s.heroNotes}>
                  <span>Free for three games</span>
                  <span>No trackers</span>
                  <span>Export any time</span>
                </p>
              </Reveal>
              <Reveal as="div" className={s.heroCardWrap}>
                <div aria-hidden className={s.heroHalo} />
                <HeroCard />
              </Reveal>
            </div>
          </section>

          {/* Steps */}
          <Reveal className={s.section} id="steps">
            <ol className={s.steps}>
              {[
                ["01", "Store", "Type them in or import the game's files."],
                ["02", "Organise", "A preset per setup, per game."],
                ["03", "Compare", "See exactly what differs."],
                ["04", "Sync", "The companion writes it to your PC."],
                ["05", "Restore", "Go back to any snapshot."],
              ].map(([n, t, d]) => (
                <li key={n}>
                  <span className={s.stepNo}>{n}</span>
                  <span className={s.stepTitle}>{t}</span>
                  <span className={s.stepText}>{d}</span>
                </li>
              ))}
            </ol>
          </Reveal>

          {/* Product */}
          <Reveal className={s.section} id="product">
            <h2 className={cx(s.h2, s.h2Lg)}>Your entire setup. One place.</h2>
            <p className={s.lead} style={{ maxWidth: "56ch", marginBottom: 40 }}>
              Games on the left, presets in the middle, the game&apos;s own settings on the right —
              the same interface you use every day, not a spreadsheet.
            </p>
            <div className={s.shotWrap}>
              <div aria-hidden className={s.shotHalo} />
              <div className={s.shot}>
                <div className={s.shotGrid}>
                  <div className={s.col}>
                    <p className={s.colTitle}>Games</p>
                    <span className={cx(s.item, s.itemOn, s.itemBar)}>
                      Counter-Strike 2 <span className={s.count}>4</span>
                    </span>
                    <span className={s.item}>
                      Rocket League <span className={s.count}>2</span>
                    </span>
                    <span className={s.item}>
                      Apex Legends <span className={s.count}>1</span>
                    </span>
                    <span className={cx(s.item, s.itemMuted)}>Add a game</span>
                  </div>
                  <div className={cx(s.col, s.col2)}>
                    <p className={s.colTitle}>Presets</p>
                    <span className={cx(s.item, s.itemOn)}>
                      Competitive <span className={s.tag}>Default</span>
                    </span>
                    <span className={s.item}>Main</span>
                    <span className={s.item}>Laptop</span>
                    <span className={cx(s.item, s.itemMuted)}>LAN (archived)</span>
                  </div>
                  <div className={s.detail}>
                    <div className={s.tabs}>
                      <span>Keyboard / Mouse</span>
                      <span className={s.tabsSep}>·</span>
                      <span>Video</span>
                      <span>Audio</span>
                      <span>Crosshair</span>
                      <span className={s.applied}>
                        <span className={s.appliedDot} />
                        Applied on win-01 and thinkpad-x1
                      </span>
                    </div>
                    {[
                      ["Mouse sensitivity", "1.85"],
                      ["Zoom sensitivity", "0.90"],
                    ].map(([k, v]) => (
                      <div key={k} className={s.drow}>
                        <span className={s.rowLabel}>{k}</span>
                        <span className={s.rowVal}>{v}</span>
                      </div>
                    ))}
                    <div className={s.drow}>
                      <span className={s.rowLabel}>Jump</span>
                      <span className={s.kbd}>Space</span>
                    </div>
                    <div className={s.drow}>
                      <span className={s.rowLabel}>Resolution</span>
                      <span className={s.rowVal} style={{ whiteSpace: "nowrap" }}>
                        1920×1080
                      </span>
                    </div>
                    <div className={s.drow}>
                      <span className={s.rowLabel}>Refresh rate</span>
                      <span className={s.rowVal} style={{ whiteSpace: "nowrap" }}>
                        240 Hz
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Presets */}
          <Reveal className={s.section} id="how">
            <div className={s.two}>
              <div>
                <h2 className={s.h2}>Keep a preset for every situation</h2>
                <p className={s.lead} style={{ maxWidth: "44ch", marginBottom: 14 }}>
                  Several setups per game — the one you play ranked on, the one that runs on the
                  laptop, the one you are still testing. Duplicate a preset, archive it, or set it
                  as the default.
                </p>
                <p className={s.sub} style={{ maxWidth: "44ch" }}>
                  Counter-Strike 2 and Rocket League arrive with their real menus. Any other game
                  can be added, with the settings you decide to track.
                </p>
              </div>
              <div className={cx(s.tree, s.mono)}>
                <div className={s.treeHead}>Counter-Strike 2</div>
                <div>├─ Main</div>
                <div>
                  ├─ <span className={s.treeOn}>Competitive</span>{" "}
                  <span className={s.treeMuted}>default</span>
                </div>
                <div>├─ Laptop</div>
                <div>
                  └─ LAN <span className={s.treeMuted}>archived</span>
                </div>
                <div className={s.treeGap} />
                <div className={s.treeHead}>Rocket League</div>
                <div>├─ Main</div>
                <div>└─ Low-end</div>
                <div className={s.treeGap} />
                <div className={s.treeHead}>
                  Apex Legends <span className={s.treeMuted}>added by you</span>
                </div>
                <div>└─ Competitive</div>
              </div>
            </div>
          </Reveal>

          {/* Compare */}
          <Reveal className={s.section} id="compare">
            <div className={s.sectionHead}>
              <div>
                <h2 className={s.h2} style={{ marginBottom: 10 }}>
                  See exactly what changed
                </h2>
                <p className={s.lead} style={{ maxWidth: "48ch" }}>
                  Put two presets side by side. Only the lines that differ are marked.
                </p>
              </div>
              <Link href="/sign-up" className={s.textlink}>
                Compare presets
              </Link>
            </div>
            <div className={s.compare}>
              <div className={s.cHead}>
                <span>Setting</span>
                <span>Competitive</span>
                <span>Laptop</span>
              </div>
              <div className={s.cRow}>
                <span>Sensitivity</span>
                <span className={s.num}>1.85</span>
                <span className={s.num}>1.85</span>
              </div>
              {[
                ["DPI", "800", "1600"],
                ["Resolution", "1920×1080", "1280×720"],
                ["Refresh rate", "240 Hz", "60 Hz"],
                ["Fullscreen", "On", "Off"],
              ].map(([k, a, b]) => (
                <div key={k} className={cx(s.cRow, s.cChanged)}>
                  <span>{k}</span>
                  <span className={s.num} style={{ whiteSpace: "nowrap" }}>
                    {a}
                  </span>
                  <span className={cx(s.num, s.cNew)} style={{ whiteSpace: "nowrap" }}>
                    {b}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Sync */}
          <Reveal className={s.section} id="sync">
            <div className={cx(s.two, s.two320)}>
              <div>
                <h2 className={s.h2}>Set it once. Keep it everywhere.</h2>
                <p className={s.lead} style={{ maxWidth: "44ch", marginBottom: 14 }}>
                  The csync companion runs on your PC, imports a game&apos;s config files as a
                  preset and writes presets back — keeping a backup first.
                </p>
                <p className={s.sub} style={{ maxWidth: "44ch" }}>
                  On Pro, csync watch keeps every PC equal to the chosen preset while the game is
                  closed, and per-PC presets let you choose what each machine runs.
                </p>
              </div>
              <SyncCard />
            </div>
          </Reveal>

          {/* History */}
          <Reveal className={s.section} id="history">
            <div className={cx(s.two, s.two320)}>
              <div className={s.history}>
                <div className={s.hHead}>History — Competitive</div>
                <div className={s.hRow}>
                  <span className={s.hWhen}>Today 19:42</span>
                  <span className={s.hWhat}>
                    Resolution <span className={s.hOld}>1920×1080</span> to{" "}
                    <span className={s.hNew}>1280×720</span>
                  </span>
                  <span className={s.hBtn}>Restore</span>
                </div>
                <div className={s.hRow}>
                  <span className={s.hWhen}>Yest. 21:13</span>
                  <span className={s.hWhat}>
                    Crosshair size <span className={s.hOld}>2</span> to{" "}
                    <span className={s.hNew}>3</span>
                  </span>
                  <span className={s.hBtn}>Restore</span>
                </div>
                <div className={s.hRow}>
                  <span className={s.hWhen}>14 Sep 18:31</span>
                  <span className={s.hWhat} style={{ color: "var(--ink-3)" }}>
                    Preset created
                  </span>
                </div>
              </div>
              <div>
                <h2 className={s.h2}>Experiment without losing what works</h2>
                <p className={s.lead} style={{ maxWidth: "44ch", marginBottom: 14 }}>
                  Every meaningful save keeps a snapshot. Change what you like, play a few rounds,
                  and restore the old values if the new ones were worse.
                </p>
                <p className={s.sub} style={{ maxWidth: "44ch" }}>
                  Free keeps ten snapshots per preset. Pro keeps all of them.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Games */}
          <Reveal className={s.section} id="games">
            <h2 className={s.h2}>Built around the games you play</h2>
            <p className={s.lead} style={{ maxWidth: "52ch", marginBottom: 32 }}>
              Two games ship with their real menus. Everything else you add yourself, with the
              settings you care about.
            </p>
            <div className={s.games}>
              <Link href="/for/cs2" className={cx(s.game, s.gameLink)}>
                <p className={cx(s.gameCode, s.mono)}>CS2</p>
                <p className={s.gameName}>Counter-Strike 2</p>
                <p className={s.gameText}>Real menu, from keyboard and mouse to crosshair.</p>
              </Link>
              <Link href="/for/rocket-league" className={cx(s.game, s.gameLink)}>
                <p className={cx(s.gameCode, s.mono)}>RL</p>
                <p className={s.gameName}>Rocket League</p>
                <p className={s.gameText}>Real menu, camera and controls included.</p>
              </Link>
              <div className={cx(s.game, s.gameAdd)}>
                <p className={cx(s.gameCode, s.gameCodeMuted, s.mono)}>+</p>
                <p className={s.gameName}>Any other game</p>
                <p className={s.gameText}>
                  Add the game, name the settings, keep presets the same way.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Pricing */}
          <Reveal className={s.section} id="pricing">
            <h2 className={cx(s.h2, s.h2Lg)}>Plans</h2>
            <p className={s.lead} style={{ maxWidth: "52ch", marginBottom: 36 }}>
              Everything that matters is in the free plan. Pro removes the limits and adds the
              automatic parts.
            </p>
            <div className={s.plans}>
              <div className={s.plan}>
                <h3 className={s.h3}>Free</h3>
                <p className={s.planSub}>For players who want their settings organised.</p>
                <p className={s.price}>0 €</p>
                <ul className={s.features}>
                  <li>Three active games</li>
                  <li>Ten snapshots per preset</li>
                  <li>Presets, compare and restore</li>
                  <li>The csync companion</li>
                  <li>Copy and export as text, Markdown, CSV or JSON</li>
                  <li>Public profile</li>
                </ul>
                <Link href="/sign-up" className={cx(s.ghost, s.ghostMd)}>
                  Create a free account
                </Link>
              </div>
              <div id="pro" className={cx(s.plan, s.planPro)}>
                <div className={s.planHead}>
                  <h3 className={s.h3}>Pro</h3>
                  <span className={s.planTag}>No limits</span>
                </div>
                <p className={cx(s.planSub, s.planSubPro)}>For players who want the whole thing.</p>
                <p className={s.price}>
                  {PRICES.monthlyAmount}{" "}
                  <span className={s.priceNote}>
                    per month, or{" "}
                    {founderOfferEnabled ? (
                      <>
                        <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>
                          {FOUNDER.lifetime}
                        </span>{" "}
                        <span style={{ textDecoration: "line-through", opacity: 0.55 }}>
                          {FOUNDER.was}
                        </span>
                      </>
                    ) : (
                      PRICES.lifetime
                    )}
                  </span>
                </p>
                <ul className={cx(s.features, s.featuresPro)}>
                  <li>Unlimited games and unlimited history</li>
                  <li>
                    Auto-switch — csync watch keeps every PC equal to the chosen preset while the
                    game is closed
                  </li>
                  <li>Per-PC presets, and a view of what is applied where</li>
                  <li>Import a settings menu from a screenshot, review the values, apply</li>
                  <li>Everything in Free</li>
                </ul>
                <Link href="/pricing" className={cx(s.cta, s.ctaMd)}>
                  Go Pro
                </Link>
              </div>
            </div>
            <p className={s.merchant}>
              Paddle is the merchant of record and handles invoices, tax and refunds.
            </p>
          </Reveal>

          {/* Desktop app */}
          <Reveal className={s.section} id="desktop">
            <div className={s.desk}>
              <div aria-hidden className={s.deskHalo} />
              <div className={s.deskGrid}>
                <div>
                  <p className={s.eyebrow}>Desktop app — coming soon</p>
                  <h2 className={s.h2} style={{ fontSize: "clamp(24px,2.8vw,32px)" }}>
                    Your settings, closer to the game
                  </h2>
                  <p className={s.lead} style={{ maxWidth: "44ch" }}>
                    Today the companion runs as csync on your PC and does the importing, writing and
                    watching. A desktop app with the same interface as the web is planned; it is not
                    available yet.
                  </p>
                </div>
                <div className={s.term}>
                  <div className={s.termBar}>csync</div>
                  <p className={cx(s.termBody, s.mono)}>
                    $ csync apply competitive
                    <br />
                    &nbsp;&nbsp;found Counter-Strike 2 on win-01
                    <br />
                    &nbsp;&nbsp;kept config.cfg.bak
                    <br />
                    &nbsp;&nbsp;wrote 34 settings
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Store */}
          <Reveal className={s.section} id="data">
            <h2 className={s.h2} style={{ marginBottom: 32 }}>
              What we store, and what we don&apos;t
            </h2>
            <div className={s.store}>
              <div>
                <h3 className={s.storeH}>Settings, nothing else</h3>
                <p className={s.storeP}>
                  The web app stores and copies the settings you put in it, plus the presets and
                  snapshots you make from them.
                </p>
              </div>
              <div>
                <h3 className={s.storeH}>Only the companion touches files</h3>
                <p className={s.storeP}>
                  Reading and writing game files happens on your PC, in the companion you run, and
                  it keeps a backup before writing.
                </p>
              </div>
              <div>
                <h3 className={s.storeH}>No analytics, no trackers</h3>
                <p className={s.storeP}>
                  Nothing follows you around this page, and you can export everything you have
                  stored at any time.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Final CTA */}
          <Reveal className={s.section} id="start">
            <div className={s.final}>
              <div aria-hidden className={s.finalHalo} />
              <div style={{ position: "relative" }}>
                <h2 className={s.finalH}>Stop rebuilding your setup</h2>
                <p className={s.finalP}>Save it once. Keep it ready wherever you play.</p>
                <div className={s.finalActions}>
                  <Link href="/sign-up" className={cx(s.cta, s.ctaLg)}>
                    Create a free account
                  </Link>
                  <Link href="/sign-in" className={s.ghost}>
                    Sign in
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </main>

        <footer className={s.footer}>
          <div className={s.footerIn}>
            <span>ConfigSync</span>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/refunds">Refunds</Link>
            <a href="mailto:hello@configsync.app" className={s.footerMail}>
              hello@configsync.app
            </a>
          </div>
        </footer>
      </div>
    </MotionProvider>
  );
}
