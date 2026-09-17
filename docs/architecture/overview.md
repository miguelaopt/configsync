# Architecture

## Stack

| Layer      | Choice                                  | Why                                                                   |
| ---------- | --------------------------------------- | --------------------------------------------------------------------- |
| Framework  | Next.js App Router + Server Actions     | One deployable, server-rendered pages, mutations without an API layer |
| UI         | React 19, Tailwind v4, Radix primitives | Accessible dialogs/menus/selects without owning that code             |
| Database   | PostgreSQL via Drizzle ORM              | Plain SQL migrations, typed queries, any Postgres host                |
| Auth       | better-auth                             | Self-hosted, email+password and optional OAuth, Drizzle adapter       |
| Validation | Zod                                     | One schema serves the DB boundary, the UI and the interchange format  |
| Tests      | Vitest (unit), Playwright (e2e)         |                                                                       |

Everything runs in one Node process. There is no separate API server, queue or cache.

## Repository map

```
app/            routes. (app)/ is authenticated, (auth)/ is sign-in/up/reset, api/ is file I/O + auth
components/     ui/ primitives · feature folders mirror the routes that use them
lib/
  actions/      server actions — the only way the client mutates data
  data/         database queries; every function takes userId first
  db/           Drizzle schema, connection, migrator
  auth/         better-auth config, session helpers, profile creation
  import-export/ interchange schema (Zod), parser, serializers (JSON/MD/CSV)
  catalog/      loader + schema for catalog/*.json (games with real menus and file mappings)
  game-configs/ Valve KeyValues and INI codecs; readGameConfig/writeGameConfig through the catalog
  api/          shared route-handler wrapper for the companion endpoints
  settings/     the generic setting type system
  copy/         clipboard formatting
  compare/      preset diff
  providers/    optional AI provider contracts (no implementation shipped); Steam store search
  validation/   Zod schemas for action input
catalog/        game templates (JSON, data only)
companion/      the csync CLI: plain Node ESM, no dependencies, its own node --test suite
drizzle/        generated SQL migrations
scripts/        migrate, seed, reset
tests/ e2e/     unit and Playwright tests
docs/           you are here
```

## Data model

```
users ─┬─ profiles (username, avatar, preferences, is_public, bio, links)
       ├─ attachments (bytea: cover images)
       ├─ plans (Paddle customer/subscription ids, status, period end — read by getPlan)
       ├─ billing_events (every accepted webhook, by Paddle event id)
       ├─ companion_tokens (name, sha256 of the token, last_used_at)
       ├─ device_games (device, source, app_id, name — what `csync scan --push` found)
       └─ games ─── presets ─┬─ categories ─── settings
          (catalog_id)       └─ revisions (JSON snapshot of the preset)
```

- Every user-owned row carries `user_id`; deletes cascade from `users` down.
- `settings.value` is JSONB and `settings.type` is an enum. Adding a type touches `lib/settings/types.ts`, the enum, and the control renderer — never the table shape.
- Slugs are unique per parent (`games(user_id, slug)`, `presets(game_id, slug)`), so URLs are `/games/<game>/<preset>`.
- Indexes cover the hot paths: library listing (`user_id, is_archived`), recents (`user_id, last_opened_at` / `updated_at`), editor loads (`category_id, position`), history (`preset_id, created_at`).
- `presets.visibility` + `share_token` exist for future public sharing. Tokens are random, never sequential ids.

## Request flow

**Read:** page (server component) → `requireUser()` → `lib/data/*` query filtered by `user_id` → render.

**Write:** client component → server action in `lib/actions/*` → `runAction(schema, input, fn)`:

1. Zod parse; field errors returned to the form, input stays on screen.
2. `requireUserId()` — throws if no valid session.
3. `fn(input, userId)` → `lib/data/*` (again filtered by `user_id`).
4. `revalidatePath()`; any thrown error becomes a human message. Database errors never reach the client.

**Files:** cover upload and downloads are route handlers (`app/api/*`) because actions are capped at 2 MB bodies and can't stream.

**Companion:** `app/api/companion/*` are JSON route handlers for the CLI. `companionRoute()` (`lib/api/companion.ts`) resolves `Authorization: Bearer gsv_…` to a user through the token's SHA-256, validates the body with Zod and maps `UnauthorizedError`/`AppError` to 401/404. The routes call the same `lib/data` functions as the web UI (`importConfigFiles`, `patchConfigFiles`), so the browser import tab and `csync import` are one code path.

**Auth routes:** `/api/auth/[...all]` is better-auth. `proxy.ts` does an optimistic cookie check to redirect unauthenticated users; real verification is `requireUser()` on every page and action.

## Presets and history

Every meaningful save (`lib/data/revisions.ts`) snapshots the preset as a `PresetDoc` — the same shape used by export. Restore = import that snapshot over the preset. The last 50 snapshots are kept per preset.

## Public pages

`/p/<username>` and `/p/<username>/<game>/<preset>` are unauthenticated. `lib/data/public.ts` is their only reader: every query requires `profiles.is_public` **and** `presets.visibility = 'public'`, skips archived rows, strips preset and setting `notes`, and returns slugs — never ids. Anything else is a 404. "Save to my vault" reuses `importFile` for the viewer's account.

## Plans

`lib/billing/plan.ts` → `getPlan(userId)` is the only answer to "is this user Pro?". It derives
the plan at read time from the `plans` row (`resolvePlan`), so a canceled subscription expires
on its own. Free's two limits live in `lib/billing/limits.ts` and are enforced in the data layer:
`createGame`/un-archive count active games, `createRevision` prunes snapshots. The Paddle webhook
(`app/api/billing/paddle`) is the only writer of `plans`; it verifies the HMAC signature and
records every event id for idempotency. With no `PADDLE_*` configured, `billingEnabled` is
false, everyone is Pro and the billing UI is hidden. Details: [billing.md](../billing.md).

## Catalog and game config files

`catalog/*.json` are export documents plus catalog-only fields: launcher ids, the game's config `files` and a per-setting `source` that maps it to a key in one of those files. `lib/game-configs` turns files into a `PresetDoc` (`readGameConfig`) and patches a preset's values back into the user's original files (`writeGameConfig`) — files are never generated from scratch, and unmapped keys are untouched. `source` never leaves the server: it is stripped on import and is not part of the export format. Details: [catalog.md](../catalog.md), [companion.md](../companion.md).

## Import / export

One Zod schema ([`lib/import-export/schema.ts`](../../lib/import-export/schema.ts)) defines the interchange document. Export serialises from the database into it; import validates into it and then writes. Markdown and CSV are derived from the same document. Format details: [import-export.md](../import-export.md).

## Security

- **Authorization**: server-side only, one `WHERE user_id = ?` per query. Clients never receive ids they can't act on.
- **Input**: every action and route handler validates with Zod; sizes are bounded (names ≤120, notes ≤5 000, options ≤200, etc.).
- **Sessions**: HttpOnly cookies with the `csync` prefix, `Secure` in production, 30-day expiry with daily refresh, 5-minute cookie cache. Password reset revokes all sessions.
- **Rate limits**: better-auth's built-in limiter — 60 req/min per IP overall, tighter on sign-in (10), sign-up (5) and reset (3).
- **CSRF**: better-auth checks `Origin` against `BETTER_AUTH_URL`; server actions carry Next's action id and are same-origin by construction.
- **Uploads**: raw body ≤2 MB, image type sniffed from bytes, stored in Postgres and served through `/api/attachments/:id` with an ownership check.
- **XSS**: React escaping; `coverUrl` must be `https:`; no `dangerouslySetInnerHTML`.
- **Headers**: `nosniff`, `X-Frame-Options: DENY`, strict referrer and permissions policies (`next.config.ts`).
- **Secrets**: `lib/env.ts` is `server-only`; only `NEXT_PUBLIC_*` reaches the browser.
- **Logging**: errors are logged with a `[csync:*]` prefix and never include credentials, tokens or setting values.

## Offline / local-first direction

Not implemented. The pieces that keep it possible: the interchange document is a complete, self-contained representation of a preset; server actions return the saved rows; ids are UUIDs generated server-side today but could be client-generated. A future sync layer would ship `PresetDoc`s, not row diffs.

## AI

Optional and off. See [ai-providers.md](ai-providers.md).
