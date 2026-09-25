# Project state

Last updated 2026-09-24, after PR #63 was merged and deployed. Live version **0.13.2**;
companion version **0.5.0**.

This is what exists and where it lives. `TODO.md` is what is left. `AGENTS.md` is how to work.

---

## Live

|                  |                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Site             | <https://configsync.app> (Cloudflare DNS, DNS-only; `www` and `http` redirect)              |
| Server           | Hetzner CX23, Falkenstein, Ubuntu 26.04, `ssh miguel@49.13.123.75`                          |
| Repo on server   | `~/configsync`, branch `main`                                                               |
| Runtime          | `docker compose --profile app --profile proxy` — app, Postgres, Caddy (Let's Encrypt)       |
| Deployed release | PR #63, version 0.13.2                                                                      |
| Deploy           | `cd ~/configsync && git pull && docker compose --profile app --profile proxy up -d --build` |
| Migrations       | run at container boot (`RUN_MIGRATIONS=true`)                                               |
| Backups          | `pg_dump` cron at 04:00 → `~/backups`, 14 days; pulled daily to Miguel's PC (below)         |
| Email            | Resend over SMTP; `hello@configsync.app` forwards to Gmail via Cloudflare Email Routing     |
| Billing          | Paddle **live** keys, webhook → `/api/billing/paddle`                                       |
| AI               | `AI_VISION_PROVIDER=anthropic`; key rotated 2026-09-24                                      |
| Monitoring       | UptimeRobot on `/pricing`                                                                   |
| Windows app      | `/ConfigSync.msi`, fetched at image build from the GitHub release `desktop` (below)         |

**Offsite backups.** Miguel's PC runs a systemd user timer, `configsync-backup.timer` (daily,
`Persistent=true`), which `rsync`s `~/backups/` from the server into `~/Backups/configsync/`
without `--delete`, so it keeps every dump even after the server prunes it. Check with
`systemctl --user list-timers | grep configsync` and `journalctl --user -u configsync-backup`.

**Deploy order with the Windows app.** `docker/Dockerfile` downloads `ConfigSync.msi` from the
GitHub release `desktop`. The `Desktop` workflow rebuilds and replaces it on every push to `main`
that touches `desktop/`, `companion/` or `package.json`. Wait for that run to finish before
deploying, or the image build can catch the asset mid-replace.

A misconfigured `.env` now kills the container at boot (`instrumentation.ts` → `lib/boot.ts`), so
the container restart-loops and Caddy serves `docker/maintenance.html` on 502/503/504 instead of a
bare "Internal Server Error". A 500 from a _running_ app is not intercepted — that is the app's own
error page.

---

## What the product does today

**Vault.** Games → presets → categories → settings. Settings are typed (number, text, toggle,
choice, key bind, resolution…), with units, ranges, options and a default value. Every save keeps a
snapshot you can restore; Free keeps the last 10 per preset.

**Companion (`csync`).** A dependency-free Node CLI. Scans Steam and Epic installs, imports a
game's real config files as a preset, writes a preset back (always a `.bak-*` first, never while
the game runs), `csync watch` keeps each game equal to its Default preset (Pro), `csync launch`
applies right before a game starts. Shipped from the site itself, not npm:
as single executables — `/csync-windows-x64.exe` and `/install.sh` (Linux → `~/.local/bin/csync`) —
built by `scripts/build-companion.mjs` at image build time. The Windows exe is not code-signed.
`csync status`, `apply`, `import` and `login` answer in JSON with `--json`; `csync discover` finds
the config keys of a game the catalog does not know yet.

**Windows app.** `desktop/`: a Tauri window around the companion (bundled as a sidecar). Paste a
token from Settings → Companion; it lists this PC's games, the preset each should run and when it
was applied, and applies or imports with one click. Built as an unsigned `ConfigSync.msi` by
`.github/workflows/desktop.yml`, so Windows shows SmartScreen on install. Downloaded from the
dashboard and Settings, not from the landing page (it needs an account to be useful).

**Multi-PC.** Devices report in with a heartbeat and what they last applied. Pro picks a different
preset per PC. The sync state shown everywhere comes from `lib/data/sync.ts`.

**Catalog.** `catalog/*.json` describes a game's menu and where its config files live per platform.
Counter-Strike 2 and Rocket League are in. `docs/catalog.md` explains adding one.

**AI screenshot import (Pro).** Upload a screenshot of a game's settings menu, Claude reads the
values, they are matched to the preset's own settings. 30 a day. **Never yet verified against a
real model with real screenshots.**

**Sharing.** `/p/<username>` and `/p/<username>/<game>/<preset>`, gated by `profiles.is_public`
_and_ `presets.visibility = 'public'`. Visitors copy, download or save a preset into their vault.

**Import / export.** One JSON format for the whole library, a game or a preset; text, Markdown and
CSV for copying out. Import walks Source → Review → Import for backups and for game config files,
with per-preset keep / skip / replace on conflicts and a read-only diff (PR #32).

**Public site.** Landing (`/`, "Two machines. One setup.": a live crosshair editor synced
between two PCs, a pinned reinstall story, the app's tabs as a demo, lighting scenes per
section), `/pricing`, `/for` + `/for/cs2` + `/for/rocket-league` (built
from the catalog: every setting with its config key, files per launcher, FAQ with schema),
`/docs/companion`, `/docs/import-export`, `/contact`, `/changelog` (from `content/changelog.ts`, one entry per version), `/terms`,
`/privacy`, `/refunds`, and `/p/<username>` profiles. Titles and descriptions carry search terms;
`robots`, `sitemap` (12 URLs), OG images, schema.org Organization / WebSite / SoftwareApplication /
FAQPage. Search Console is verified and the sitemap submitted (owner, 2026-09-20); Bing done.

**Billing.** Paddle is merchant of record, domain approved. Monthly and lifetime, plus the alpha
founder offer (lifetime at 10 € through a Paddle discount code, `FOUNDER` in
`lib/billing/public.ts`). The webhook handles `transaction.*`, `subscription.*` and
`adjustment.*`; a real purchase and refund were verified end to end on 2026-09-24.

---

## Layout of the code

```
app/
  (landing)/        the marketing home page — its own CSS module, own header; components/landing/
  (marketing)/      /pricing /terms /privacy /refunds /p/*  — shared chrome, public
  (auth)/           split-screen sign-in / sign-up / forgot / reset
  (app)/            the product: dashboard, games, preset editor, import, export, search, settings
  api/              auth, billing webhook, companion, exports, attachments, AI
  opengraph-image.tsx · twitter-image.tsx · robots.ts · sitemap.ts · icon.png · favicon.ico
components/
  ui/               primitives (Button, Badge, Select, Dialog, …)
  dashboard/panels  Panel, SyncPill, ComingSoonPanel — the card grammar every page uses
  app/shell.tsx     rail + top bar + command palette
  games/ presets/ settings/ billing/ marketing/ landing/ public/
lib/
  data/             every database read/write, server-only. sync.ts is the shared sync summary
  billing/          plan.ts (gating), limits.ts, public.ts (prices, features, comparison)
  catalog/ game-configs/ import-export/   the file formats and the catalog
  auth/ db/ providers/ settings/ copy/ utils/
companion/          the CLI; built into public/csync-* single executables at build time
desktop/            the Windows app (Tauri); built into ConfigSync.msi by CI
catalog/            one JSON per supported game
drizzle/            SQL migrations, 0000…0005
docs/               launch, billing, companion, catalog, import-export, self-hosting, decisions
```

---

## Design system

Dark only. Tokens in `app/globals.css`, values from `ConfigSync-brand-assets/README.txt`.

ground `#161826` · surface `#1C1F30` · raised `#22263A` · line `#2A2D42` · ink `#E9E9ED` ·
ink-2 `#A9AAC0` · ink-3 `#8F93AB` · accent `#9184D9` · accent-text `#B7A6FF` ·
good `#4ADE80` · bad `#F2736A` · stage `#12131F`

Type is Geist throughout (Barlow was dropped). Cards are `.panel` — 14px radius, 1px `line`
border. Primary buttons carry the purple gradient defined in the base layer. The brand mark is one
component, `components/app/logo.tsx`, reused by the app, the landing and the OG image.

All four main screens follow the same shape: a page header, a main column of panels, and a 336px
rail. The rail is where `ComingSoonPanel` lives.

---

## Reserved, not built

These are visible in the UI as `Coming soon` cards because the design calls for the space, and
deliberately carry no invented data:

- **Friends** — who is online, what they are playing (dashboard rail)
- **Public profiles / Community presets** — a discovery feed (dashboard, library, game page)
- **Pro player setups** — verified configs (dashboard, game page)

Also drawn in the mockups but not built, for the same reason: standalone Presets / Compare / Sync
nav entries, a Play/Launch button, and the game-page tabs. The per-setting details panel is built
(0.14.0: click a setting's name) in its honest form: value against default, range or choices,
the file and key a catalog game keeps it in, and the user's description and notes; no "tip" or
"related settings", which have no data.

---

## Known ceilings

Grep `ponytail:` for the full list. The ones that matter:

- `syncLabelsForGames` fingerprints one preset per device per game. Fine for a personal library;
  cache per `(game, version)` if someone shows up with 200 games.
- The AI daily cap is checked before the call and counted after, so a burst can overshoot by a few
  images.
- `/api/companion/sync` loads and fingerprints every catalog preset per poll.
- The production image has no `sharp`, so `/_next/image` hangs on large sources once its cache is
  empty. Nothing uses it today (the auth artwork is a pre-sized WebP served `unoptimized`); add
  `sharp` as a direct dependency before putting a big photo through `next/image`.

---

## Accounts and secrets

- Production `.env` on the server; `.env.bak-*` beside it. Never in git.
- Local `.env` uses **sandbox** Paddle keys. Do not put live keys there.
- Demo data locally: `pnpm db:seed` → `demo@example.com` / `demo-vault-2026`.
- Miguel's production account has Pro through `plans.source = 'manual'`.

---

## History

PRs #1–#45, all merged except #24 (superseded by this file). #1 foundation, #2 ConfigSync rebrand +
Paddle, #3 auto-switch, #4 public profile, #5 AI screenshot import, #6 multi-PC, #7 launch prep,
#8–#11 deploy fixes and launch polish, #12–#19 landing experiments, #20 the Nocturne landing,
#21–#22 the auth pages, #23 the whole app remapped onto the brand plus the marketing pages, SEO and
the companion installer, #25–#29 backdrop and header polish, #31 dashboard empty state, #32 the
import review flow (ChatGPT), #33 searchable titles + `/docs/companion` + panel design on every app
page, #34 `/for/<game>` pages + public-profile switch autosave, #35 greeting gradient, #36
`/changelog`, #37 one version number from `package.json`, #38 working agreement and project state,
#39 ZIP and recent exports, #40 Settings polish, #41 formatting fix, #42 standalone Windows and
Linux companion binaries, #43 Alpine image-build fix, #44 refreshed auth artwork, a quieter
landing hero and corrected release state, #45 high-resolution auth artwork, #47 never write
while the game runs, #48 founder offer, #49 `/contact` + `/docs/import-export`, #50 CS2 machine
convars, #51 `csync discover`, #52–#53 founder code and payment links, #54 cookie notice and
founder offer redrawn, #55 companion JSON, #56 refund webhook, #57 `csync login --json`, #58 the
Windows app, #60 the new landing page, #61 changelog wording, #62 account-first downloads and the
auth artwork, #63 game tile textures. #59 (a simpler redesign) was closed for #60; #46 (marketing
roadmap docs) is still open.

Version history: 0.1.0 foundation (17 Sep) · 0.2.0 launch (18 Sep) · 0.3.0 import review + Nocturne
(19 Sep) · 0.4.0 game pages, docs, SEO · 0.5.0 export rebuild · 0.5.1 Settings polish · 0.6.0
standalone companion binaries (20 Sep).
Version 0.6.1 refreshed the auth artwork and simplified the landing hero (21 Sep). 0.7.0–0.12.1
founder offer, pages, companion discover/JSON, billing fixes (21–23 Sep). 0.13.0 the Windows app
and the new landing, 0.13.1 account-first downloads, 0.13.2 game textures (24 Sep).

`docs/decisions/` holds the architecture decisions. `WALKTHROUGH.md` is the operator's tour as of
19 Sep (kept for its test matrix; this file wins where they disagree).
