# Project state

Last updated 2026-09-20, after PR #43 was merged and deployed. Live version **0.6.0**;
companion version **0.2.0**.

This is what exists and where it lives. `TODO.md` is what is left. `AGENTS.md` is how to work.

---

## Live

|                 |                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Site            | <https://configsync.app> (Cloudflare DNS, DNS-only; `www` and `http` redirect)                 |
| Server          | Hetzner CX23, Falkenstein, Ubuntu 26.04, `ssh miguel@49.13.123.75`                             |
| Repo on server  | `~/configsync`, branch `main`                                                                  |
| Runtime         | `docker compose --profile app --profile proxy` — app, Postgres, Caddy (Let's Encrypt)          |
| Deployed commit | `77bbd0c` (merge of PR #43), version 0.6.0                                                     |
| Deploy          | `cd ~/configsync && git pull && docker compose --profile app --profile proxy up -d --build`    |
| Migrations      | run at container boot (`RUN_MIGRATIONS=true`)                                                  |
| Backups         | `pg_dump` cron at 04:00 → `~/backups`, 14 days. **Still only on that machine.**                |
| Email           | Resend over SMTP; `hello@configsync.app` forwards to Gmail via Cloudflare Email Routing        |
| Billing         | Paddle **live** keys, webhook → `/api/billing/paddle`                                          |
| AI              | `AI_VISION_PROVIDER=anthropic`; the key was shown in a chat on 2026-09-19 — rotate if not done |
| Monitoring      | UptimeRobot on `/pricing`                                                                      |

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

**Public site.** Landing (`/`), `/pricing`, `/for` + `/for/cs2` + `/for/rocket-league` (built
from the catalog: every setting with its config key, files per launcher, FAQ with schema),
`/docs/companion`, `/changelog` (from `content/changelog.ts`, one entry per version), `/terms`,
`/privacy`, `/refunds`, and `/p/<username>` profiles. Titles and descriptions carry search terms;
`robots`, `sitemap` (12 URLs), OG images, schema.org Organization / WebSite / SoftwareApplication /
FAQPage. Search Console is verified and the sitemap submitted (owner, 2026-09-20).

**Billing.** Paddle is merchant of record. Monthly and lifetime. The webhook handles
`transaction.*`, `subscription.*` and `adjustment.*` — a refund or chargeback revokes Pro.

---

## Layout of the code

```
app/
  (landing)/        the marketing home page — its own CSS module, own header/footer
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

Also drawn in the mockups but not built, for the same reason: a per-setting details side panel
(description and default exist; "tip" and "related settings" do not), standalone
Presets / Compare / Sync nav entries, a Play/Launch button, and the game-page tabs.

---

## Known ceilings

Grep `ponytail:` for the full list. The ones that matter:

- `syncLabelsForGames` fingerprints one preset per device per game. Fine for a personal library;
  cache per `(game, version)` if someone shows up with 200 games.
- The AI daily cap is checked before the call and counted after, so a burst can overshoot by a few
  images.
- `/api/companion/sync` loads and fingerprints every catalog preset per poll.

---

## Accounts and secrets

- Production `.env` on the server; `.env.bak-*` beside it. Never in git.
- Local `.env` uses **sandbox** Paddle keys. Do not put live keys there.
- Demo data locally: `pnpm db:seed` → `demo@example.com` / `demo-vault-2026`.
- Miguel's production account has Pro through `plans.source = 'manual'`.

---

## History

PRs #1–#43, all merged except #24 (superseded by this file). #1 foundation, #2 ConfigSync rebrand +
Paddle, #3 auto-switch, #4 public profile, #5 AI screenshot import, #6 multi-PC, #7 launch prep,
#8–#11 deploy fixes and launch polish, #12–#19 landing experiments, #20 the Nocturne landing,
#21–#22 the auth pages, #23 the whole app remapped onto the brand plus the marketing pages, SEO and
the companion installer, #25–#29 backdrop and header polish, #31 dashboard empty state, #32 the
import review flow (ChatGPT), #33 searchable titles + `/docs/companion` + panel design on every app
page, #34 `/for/<game>` pages + public-profile switch autosave, #35 greeting gradient, #36
`/changelog`, #37 one version number from `package.json`, #38 working agreement and project state,
#39 ZIP and recent exports, #40 Settings polish, #41 formatting fix, #42 standalone Windows and
Linux companion binaries, #43 Alpine image-build fix.

Version history: 0.1.0 foundation (17 Sep) · 0.2.0 launch (18 Sep) · 0.3.0 import review + Nocturne
(19 Sep) · 0.4.0 game pages, docs, SEO · 0.5.0 export rebuild · 0.5.1 Settings polish · 0.6.0
standalone companion binaries (20 Sep).

`docs/decisions/` holds the architecture decisions. `WALKTHROUGH.md` is an operator's tour but is
**out of date** — it still describes merging PRs #5 and #6.
