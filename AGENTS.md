<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ConfigSync — working agreement

Read `PROJECT_STATE.md` for what exists and `TODO.md` for what is next. This file is how to work
here.

## What this is

A hosted product, live at <https://configsync.app>. Players save their game settings, keep a
preset per setup, compare two, and have a companion CLI write those settings into the games' own
config files on every PC they play on. Free: 3 active games, 10 snapshots per preset. Pro:
2.99 €/month or 24.99 € once, sold through Paddle.

It is a real business, not a demo. A broken deploy costs money and trust.

## Stack

Next.js 16 (App Router, React 19, Server Components by default), TypeScript strict, Tailwind v4,
Drizzle + Postgres, better-auth, Radix primitives, Zod. pnpm. Deployed with Docker Compose behind
Caddy on a Hetzner box.

## Rules that are not negotiable

1. **Never invent a feature in the UI.** If the data does not exist, the screen does not show it.
   Reserved space gets a `Coming soon` card (`ComingSoonPanel`), never fake avatars, fake counts or
   fake testimonials. Several such cards exist today on purpose.
2. **Server-only code stays server-only.** `lib/data/*`, `lib/auth/*`, `lib/db/*` are
   `import "server-only"`. A client component that imports them drags Postgres into the browser
   bundle and the page 500s. Shared constants for client components live in `lib/types.ts` or
   another client-safe module. This has already bitten us once — `GAME_SORTS` had to move.
3. **Pro gating happens on the server**, via `getPlan()` in `lib/billing/plan.ts`. The client only
   decides what to render.
4. **The companion never writes a game file while the game is running, and never without a `.bak-*`
   copy first.** That contract is why people trust it.
5. **Run `pnpm check` before claiming anything is done** (typecheck, eslint, vitest). For UI work,
   also look at the page — screenshot it with Playwright and actually read it.
6. **Branch, then open a PR.** Merge and deploy only when the owner says so in that session —
   never assume yesterday's go-ahead carries over.
7. **Nothing user-visible mentions self-hosting, open source or the repository.** The product is
   the hosted service; code comments may say "self-host", copy may not.

## Conventions

- Branch `feat/<name>` or `fix/<name>`; conventional commits (`feat(sync): …`); PR to `main`; CI
  green before merge. Never merge locally.
- Migrations: edit `lib/db/schema.ts` → `pnpm db:generate --name <thing>` → read the SQL →
  `pnpm db:migrate`. They run automatically at container boot in production.
- Deliberate shortcuts carry a `ponytail:` comment naming the ceiling and the upgrade path. Grep
  for them before "optimising" something that was left simple on purpose.
- Prices live in exactly one place, `lib/billing/public.ts`. Business details in `lib/legal.ts`.
  Plan limits in `lib/billing/limits.ts`. Never hardcode any of them in a page.
- Public pages that are built from data keep the data where it already is: game pages read
  `catalog/*.json`, the changelog reads `content/changelog.ts`, the companion guide mirrors what
  Settings → Companion shows. No CMS, no markdown loader.

## Design

Dark only — the light theme was deliberately removed, along with the theme control. One palette,
defined once in `app/globals.css` from `ConfigSync-brand-assets/README.txt`: ground `#161826`,
surface `#1C1F30`, ink `#E9E9ED`, accent `#9184D9`, accent-light `#B7A6FF`.

- Card chrome is the `.panel` utility plus `components/dashboard/panels.tsx` (`Panel`, `SyncPill`,
  `ComingSoonPanel`). Every app page uses it now (Settings, Export, Search, Compare, Import
  included); do not invent a second card style. `PageHeader` is the app heading; marketing pages
  use the 40/52px hero from `/pricing`.
- Marketing pages share `components/marketing/chrome.tsx` (header, footer, backdrop) through the
  `(marketing)` layout; the root 404 and error pages use the same pieces. Docs-style pages reuse
  `LegalPage` from `components/marketing/legal.tsx` with `updated={null}` and a custom `footer`.
- The brand mark is drawn once, in `components/app/logo.tsx`. Never redraw it.
- A game can override `--accent` on its own subtree — that is why some badges are amber on the CS2
  page. It is a feature.
- Reuse `components/ui/*` (Button, Badge, Select, Dialog…). No new UI dependency without a reason
  that survives being questioned.

## Releases and the version number

`package.json` `version` is the only version. `next.config.ts` bakes it into
`NEXT_PUBLIC_APP_VERSION`; `SITE.version` (sidebar, Settings) and `/changelog` read it. Never
write a version string anywhere else.

Every PR that changes what a user can see or do ships as a release:

1. Bump `package.json` — semver, still `0.x`:
   - **minor** (`0.4.0 → 0.5.0`) for something new: a page, a feature, a game in the catalog, a
     redesign.
   - **patch** (`0.4.0 → 0.4.1`) for fixes, copy, polish, SEO and dependency bumps.
   - `1.0.0` is a decision for the owner, not a side effect.
2. Add an entry at the top of `content/changelog.ts` with the same `version` and the deploy date,
   written for the user (what they can now do), tagged `new` / `improved` / `fixed`.
3. Several PRs deployed the same day share one entry and one bump.

`companion/package.json` has its own version. Bump it only when `companion/` changes, and say so
in the changelog entry (`csync 0.2.0`).

Nothing to write for refactors, tests, docs or CI-only changes.

## Commands

```bash
pnpm dev                # localhost:3000
pnpm check              # typecheck + lint + unit tests — the gate
pnpm test:e2e           # Playwright; needs port 3100 free (kill a running pnpm dev first)
pnpm db:migrate         # apply migrations locally
pnpm db:seed            # demo@example.com / demo-vault-2026
pnpm pack:companion     # rebuild public/csync.tgz (the installer the site serves)
```

## Testing notes

- Playwright's `getByRole(..., { name })` matches **substrings**. Adding a word to the UI can make
  an old selector ambiguous — pass `exact: true` when the name is a common word.
- The e2e suite runs the real app against the real database. It is slow and worth it.
- Unit tests cover the parsers, the diff, billing and coercion. Add one when you touch logic; not
  for a one-line render change.
