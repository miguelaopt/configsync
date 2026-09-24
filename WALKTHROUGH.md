# ConfigSync — walkthrough

A guided tour for the person who has to run, test and ship this thing. It complements the
reference docs in `docs/` (linked where they go deeper) and is written for a fresh machine.

> **Historical (written 2026-09-19, around PRs #5–#6).** The feature tour and the test matrix
> below still hold; the release state, deploy details and what is left do not. For those read
> `PROJECT_STATE.md` (what is live) and `TODO.md` (what is next).

---

## 1. What the system is

One Next.js server, one Postgres database, one optional CLI on the gaming PC.

```
browser ── Next.js app (server components, server actions, route handlers) ── Postgres
                 │
                 ├── /api/companion/*  ← csync CLI on the player's PC (Bearer token)
                 ├── /api/billing/paddle  ← Paddle webhooks (Free/Pro)
                 ├── /api/ai/screenshot   → Anthropic (Pro screenshot importer)
                 └── /p/<username>/…      ← public, no session
```

**Domain model** (`lib/db/schema.ts`): `users → games → presets → categories → settings`.
Settings are generic (`type` + JSON `value`, see `lib/settings/types.ts`); nothing is
game-specific. Around that: `revisions` (snapshots per preset), `profiles` (username, public
flag, bio, links), `attachments` (covers), `plans` (Paddle state), `companion_tokens`,
`device_games` (what `csync scan` found), `devices` + `device_presets` (per-PC choices and
last applied state), `ai_requests` (screenshot importer usage).

**Where things live**

| Path                              | What                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `app/(marketing)/`                | Landing, `/pricing`, public profiles `/p/…`. No session.                                              |
| `app/(auth)/`                     | Sign-in/up, password reset (better-auth).                                                             |
| `app/(app)/`                      | The vault: dashboard, games, presets, import/export, search, settings. Session required (`proxy.ts`). |
| `app/api/`                        | Route handlers: auth, companion, billing webhook, export, cover upload, AI screenshot, public export. |
| `lib/data/*`                      | The only code that talks to the DB. Every query filters by `userId`. Server-only.                     |
| `lib/actions/*`                   | Server actions = validate (zod) → `lib/data` → `revalidatePath`. All go through `runAction`.          |
| `lib/billing/`                    | `getPlan()` (the one answer to "is this user Pro?"), `LIMITS`, Paddle client + webhook mapping.       |
| `lib/catalog/` + `catalog/*.json` | Games with real menus and config-file mappings (CS2, Rocket League).                                  |
| `lib/game-configs/`               | Parsers/writers for the game file formats (KeyValues, INI).                                           |
| `lib/import-export/`              | The interchange JSON (`gamesettings-vault` v1), parser, serializer, fingerprint.                      |
| `lib/providers/`                  | Pluggable externals: Steam store lookup, Anthropic vision.                                            |
| `lib/ai/`, `lib/companion/`       | Pure logic for the screenshot importer and device status (browser-safe, tested).                      |
| `components/`                     | UI. `components/ui` are the Radix wrappers; the rest is per feature.                                  |
| `companion/`                      | The `csync` CLI (plain Node ESM, no build step). Its own `node --test` suite.                         |
| `drizzle/`                        | SQL migrations, generated from the schema. Never edited by hand except data backfills.                |
| `docs/`                           | Reference docs, ADRs, specs and implementation plans (`docs/superpowers/`).                           |
| `e2e/`, `tests/`                  | Playwright walkthrough (desktop + mobile) and vitest unit tests.                                      |

**Request flow in one paragraph.** A page under `app/(app)` calls `requireUser()`, reads via
`lib/data`, renders server components and passes plain data to client components. Mutations
are server actions in `lib/actions` that validate with zod, call `lib/data`, and revalidate.
The companion CLI hits `app/api/companion/*` with a personal token (`companionRoute` wraps
auth + validation + error mapping). Pro features check `getPlan()` on the server, never on
the client. More in `docs/architecture/overview.md`.

**Plans.** Without `PADDLE_*` variables every account is Pro (self-hosting). With them, Free =
3 active games, 10 snapshots per preset, no auto-switch, no screenshot importer, no per-PC
presets. `lib/billing/limits.ts` is the single place those numbers live.

---

## 2. Local setup and test profiles

```bash
cp .env.example .env               # set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm install
docker compose up -d db            # Postgres 16 on localhost:5432 (container settings_saver-db-1)
pnpm db:migrate
pnpm db:seed                       # demo account + example library
pnpm dev                           # http://localhost:3000
```

**Accounts on the local database**

| Account                                | Plan                                           | Use it for                                                                                                                   |
| -------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `demo@example.com` / `demo-vault-2026` | Pro (a Paddle sandbox subscription is on file) | Everything Pro: auto-switch, screenshot importer, per-PC presets, public profile. Owns CS2 + Rocket League from the catalog. |
| any fresh sign-up                      | Free (while `PADDLE_*` are set in `.env`)      | Free limits, upsells, 403s from Pro routes.                                                                                  |

If your `.env` has no `PADDLE_*`, everyone is Pro and you cannot test Free paths. To grant Pro
by hand: `docs/billing.md` → "Granting Pro by hand" (one `insert into plans`).

**Handy commands**

```bash
docker exec -it settings_saver-db-1 psql -U gsv gsv      # SQL console
pnpm db:studio                                             # Drizzle Studio
pnpm db:reset && pnpm db:migrate && pnpm db:seed           # start over (dev only)
pnpm csync login http://localhost:3000                      # pair this PC with the local vault
```

**Paddle sandbox (only for billing work).** Keys live in `.env` (never in chat or commits).
Webhooks need a public URL: `ngrok http 3000` on the static domain configured in the Paddle
sandbox destination; stop ngrok afterwards. Test card `4242 4242 4242 4242`, any future date,
country PT (23 % VAT shows up). A completed checkout arrives as `transaction.completed` →
`plans` row → Pro.

**AI screenshot importer (only for that feature).** Add `AI_VISION_PROVIDER=anthropic` and
`AI_VISION_API_KEY=sk-ant-…` to `.env` and restart `pnpm dev`. Without them the menu entry
does not exist. Cost is roughly a cent per screenshot; the Pro cap is 30 per 24 h per user.

---

## 3. How to test everything

### 3.1 Automated

```bash
pnpm check                                  # typecheck + eslint + vitest (unit)
node --test "companion/test/**/*.test.mjs"   # csync unit tests
pnpm format:check                           # prettier (CI fails on this)
pnpm build                                  # catches server-only modules leaking into client bundles
pnpm test:e2e                               # Playwright, starts its own server on :3100 with dummy Paddle vars
```

CI (`.github/workflows/ci.yml`) runs exactly these on every PR, plus `pnpm db:migrate` against
a service Postgres. Green CI is the merge bar.

### 3.2 Manual, by area

Sign in as `demo@example.com` unless the row says otherwise. Each line is one thing to click
and one thing to see.

**Vault basics**

- `/games` → New game → custom name + platform → game page with an empty Default preset.
- Preset page → Add category → Add setting of a few types (toggle, slider with range, dropdown
  with options, keybind, resolution) → values render as game-menu controls; the mobile layout
  stacks wide controls under their labels.
- Edit values inline → Save → History (⋯ menu) shows a snapshot; restore an older one.
- ⋯ → Duplicate, Favorite, Set as default, Archive, Delete (confirm dialog).
- Game page → Compare (needs 2+ presets) → side-by-side diff.
- Copy menu → plain / Markdown / JSON land in the clipboard.

**Import / export**

- `/export` → JSON of the whole library; also per-game and per-preset from their ⋯ menus (JSON,
  Markdown, CSV).
- `/import` → paste that JSON → games/presets created, nothing overwritten (additive only).
- `/import` → Game files tab → CS2 + `tests/fixtures/cs2_video.txt` → preview says how many
  settings → Import as preset → preset shows Resolution 1280×…

**Catalog**

- Add game → pick Counter-Strike 2 from the catalog → real menu with categories, options,
  ranges. Adding it twice is refused ("You already have…").

**Search**

- `/search?q=sensitivity` and the ⌘K palette find settings across games.

**Public profile**

- Settings → Profile → Public profile on, bio, up to 6 https links → the URL under the switch.
- A preset's ⋯ → Make public → open `/p/<username>` in a private window: profile, game, preset;
  Download JSON; "Save to my vault" as another account (Free limit applies) or via sign-up.
- Notes never appear publicly. Archived or private items 404.

**Billing (Free/Pro)**

- Fresh account → add a 4th game → blocked with "Free keeps up to 3 active games…" and a
  "See plans" toast action. `/pricing` shows Free vs Pro with the two Paddle prices.
- Sandbox checkout (see §2) → webhook → the Pro badge appears in the header; Settings → Plan
  shows the subscription and "Manage subscription" (Paddle customer portal).

**Companion CLI (on this machine)**

- Settings → Companion → Create token → `pnpm csync login http://localhost:3000` (paste).
- `pnpm csync scan --push` → Settings → Companion lists this device with its game count.
- `pnpm csync games` → shows which CS2 / Rocket League files were found and the exact Steam
  launch-options line.
- `pnpm csync import cs2` → a new preset "Imported from <host> <date>" with the real values.
- `pnpm csync apply cs2 <slug> --dry-run` → planned changes; without `--dry-run` it writes and
  leaves `<file>.bak-<timestamp>` next to each file. **Restore from the newest `.bak-*`
  afterwards** — these are your real game files.
- `pnpm csync launch cs2 -- echo hi` → applies the target, prints `hi`. Never blocks the game.

**Auto-switch + per-PC presets (Pro)**

- `pnpm csync watch --once` → logs `watching 2 catalog games … as "<host>" (per-PC presets on)`
  and either `applied …`, `waiting: <game> is running` or nothing (already in sync).
- Change the CS2 Default in the web app → `--once` again → applied (backup made).
- Game page → "On your PCs" card → pick "CLI check" for this host → badge **Pending** →
  `--once` → card says `cli-check · applied just now`; pick Default again → `--once` applies
  the Default.
- Settings → Companion → device row shows platform, last seen, **Forget**; forgetting and
  running `--once` brings it back.
- Free account: `GET /api/companion/sync` with its token → 403 and the CLI exits 2 with the
  sentence; no "On your PCs" card.
- `pnpm csync watch --install` / `--uninstall` → systemd user unit (`journalctl --user -u
csync-watch -f`).

**AI screenshot importer (Pro, needs the key in `.env`)**

- Preset page → ⋯ → Import from screenshot… → privacy line names Anthropic → pick 1–5
  screenshots of CS2's Video settings → Analyse.
- Review: rows matched to existing settings show "Now: <current>" vs the proposed value with
  the normal control; low confidence gets **Check**; unreadable values show "Read as …".
  Unmatched names sit under "Not in this preset" with name/type/category selects.
- Apply → toast → values changed, History has "Imported from screenshot".
- Free account: the menu entry carries a **Pro** badge and opens an upsell; the route returns 403.
- `select count(*), sum(input_tokens) from ai_requests;` grows by one row per image; failed
  calls (bad key, refusal) add nothing.
- `AI_VISION_PROVIDER` unset → entry gone.

### 3.3 Browser automation for repeatable checks

`pnpm test:e2e` covers the Free/Pro vault walkthrough. For ad-hoc checks, a throwaway script
with `import { chromium } from "@playwright/test"` run from the repo root (so it resolves the
installed package) works well — the PR descriptions of #5 and #6 list what was checked that way.

---

## 4. Deploying to a server

Nothing is deployed yet. The complete, ordered procedure for `configsync.app` (domain, Hetzner,
Caddy, legal pages, email, Paddle live, backups) is **`docs/launch.md`**; this section is the
short version.

**Prerequisites**

1. A domain (`configsync.app`, `configsync.io`, `configsync.sh`, `csync.io`, `csync.sh` and
   `getcsync.com` were unregistered on 2026-09-19; `.gg` is the expensive one). Point an `A`
   record at the server.
2. A small VPS (2 vCPU / 2–4 GB is plenty) with Docker + Compose and ports 80/443 open.
3. Pages Paddle's live review requires: `/terms`, `/privacy`, `/refunds` exist; fill the
   business details in `lib/legal.ts` first.

**Steps**

```bash
git clone https://github.com/miguelaopt/configsync && cd configsync
cp .env.example .env
```

Set in `.env`: `BETTER_AUTH_SECRET` (new, random), `BETTER_AUTH_URL` and
`NEXT_PUBLIC_APP_URL` (`https://<domain>`, no trailing slash), `SMTP_URL` + `EMAIL_FROM`
(password reset; any SMTP provider), `NEXT_PUBLIC_REPO_URL`, the six `PADDLE_*` values from
the **live** Paddle account with `NEXT_PUBLIC_PADDLE_ENV=production`, and optionally
`AI_VISION_PROVIDER=anthropic` + `AI_VISION_API_KEY`. GitHub OAuth is optional
(callback `https://<domain>/api/auth/callback/github`).

```bash
docker compose --profile app up -d --build      # db + app on :3000, migrations run at boot
```

Put TLS in front. Caddy is two lines:

```
<domain> {
    reverse_proxy localhost:3000
}
```

Then, in Paddle live: catalog product + two prices, API key, client token, notification
destination `https://<domain>/api/billing/paddle` with the events listed in `docs/billing.md`.
Buy Pro once with a real card, refund it, and confirm the `plans` row appeared and went away.

**Operate**

- Update: `git pull && docker compose --profile app up -d --build`.
- Backup: `docker compose exec db pg_dump -U gsv gsv > backup-$(date +%F).sql` (cron it).
- Logs: `docker compose logs -f app`; the billing webhook logs `[csync:billing]`, companion
  errors `[csync:companion]`, AI errors `[csync:ai]`.
- Grant Pro by hand: `docs/billing.md`. Rotate `BETTER_AUTH_SECRET` only if you accept
  signing everyone out.

Option B (Node without Docker) is in `docs/self-hosting.md`.

---

## 5. What is left

**Before launch (blocked on the domain)**

- Pick and register the domain; DNS; VPS; deploy as in §4.
- Legal pages exist (`/terms`, `/privacy`, `/refunds`); fill `lib/legal.ts` (address, NIF) and
  read them once on the live site.
- Paddle **live** account: product, prices, keys, webhook, one real test purchase + refund.
- Transactional email provider for password reset (`SMTP_URL`).
- Landing page redesign (Miguel is doing this himself; nothing in the PRs touches
  `app/(marketing)/page.tsx`).

**Open PRs**

- #5 screenshot importer — everything verified except one pass with a real
  `AI_VISION_API_KEY` (tune the prompt in `lib/providers/anthropic-vision.ts` or the coercion
  in `lib/settings/coerce.ts` if the model misreads CS2's menu).
- #6 per-PC presets — stacked on #5. Merge #5 **without** `--delete-branch` (GitHub would
  close #6), then retarget #6 to `main`.

**Roadmap after that**

- Desktop tray app wrapping `csync watch` (autostart exists; a tray is UX sugar).
- More catalog games (`docs/catalog.md`: one JSON per game with menu + file mappings).
- Offline OCR provider for self-hosters who don't want images leaving the server
  (`ScreenshotParser` contract in `lib/providers/screenshot.ts`).

**Known corners** (deliberate, marked `ponytail:` in code)

- The AI daily cap is checked before the call and counted after; a burst can overshoot by a
  few images.
- `/sync` loads and fingerprints every catalog preset per poll; fine for a handful of games.
- Device status per PC costs one fingerprint each on the game page.

---

## 6. Working conventions

- Every change: brainstorm → spec (`docs/superpowers/specs/`) → plan
  (`docs/superpowers/plans/`) → branch `feat/<name>` → push → PR to `main` with CI green.
  Never merge locally; review the diff on GitHub.
- Commits are conventional (`feat(sync): …`, `docs: …`) and pass `pnpm format:check`.
- Migrations: change `lib/db/schema.ts`, `pnpm db:generate --name <thing>`, review the SQL,
  `pnpm db:migrate`. Stacked branches keep the numbering linear.
- Pro gating lives on the server (`getPlan()`); the client only decides what to show.
- The companion never writes a game file while the game runs and never without a `.bak-*`.
