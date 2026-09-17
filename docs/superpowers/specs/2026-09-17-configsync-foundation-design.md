# ConfigSync foundation — rebrand, license, plans, Paddle billing

**Status:** approved 2026-09-17 · **Builds on:** `feat/catalog-companion` (PR #1)

## Goal

Turn GameSettings Vault into **ConfigSync**: a hosted service with a Free plan and a paid Pro plan
(subscription or lifetime, sold through Paddle), while keeping the code source-available and
fully unlocked for personal self-hosting. This sub-project delivers only the foundation — the
name, the license, the `plan` concept with its two Free limits, and the checkout/webhook loop.
Pro features that need new subsystems (auto-switch, public profile, AI importer, multi-PC sync)
come later, each with its own spec, and gate on `getPlan()` from this one.

## Product decisions (from the brainstorm)

| Decision     | Choice                                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Name         | ConfigSync. CLI `csync`. Token prefix `csync_`. Config `~/.config/csync/config.json`. |
| License      | FSL-1.1-MIT (Functional Source License, MIT after two years).                         |
| Distribution | Hosted site operated by the owner; web now, desktop app later wraps the CLI.          |
| Payments     | Paddle Billing (merchant of record). Monthly 2.99 € and Lifetime 24.99 €.             |
| Free limits  | 3 active (non-archived) games; 10 snapshots per preset.                               |
| Pro          | Unlimited games and snapshots; future Pro features gate on `plan === "pro"`.          |
| Self-host    | Billing not configured ⇒ every user is Pro.                                           |

## A. Rebrand

Replace every user-visible and identifier use of the old name:

- **Text:** "GameSettings Vault" → "ConfigSync" in UI, emails (`EMAIL_FROM` default, reset
  subject), `lib/site.ts`, docs, README, ADRs' headers stay historical (ADRs are records).
- **Packages:** root `name` → `configsync`; companion → `csync`, `bin: { csync }`; root script
  `gsv` → `csync`.
- **Companion:** `companion/bin/csync.mjs`; config dir `csync`; help text and all `gsv …`
  examples. The API base `/api/companion/*` is internal and stays.
- **Tokens:** `csync_` + 32 random bytes base64url. `userIdForToken` accepts only `csync_`.
  Existing `gsv_` tokens stop working (pre-launch; the Settings card tells users to log in
  again).
- **Cookies/logs:** better-auth `cookiePrefix` → `csync`; log prefixes `[csync:*]`.
- **Repo URL:** `SITE.repoUrl` already reads `NEXT_PUBLIC_REPO_URL`; default changes to
  `https://github.com/miguelaopt/configsync`. Renaming the GitHub repo is the owner's action.
- **Not renamed:** database name, env var names, route paths, existing migration files.

## B. License

`LICENSE` becomes the FSL-1.1-MIT text (canonical text from fsl.software, licensor
"Miguel Ferreira", software "ConfigSync"). README: "source-available under the FSL; converts to
MIT two years after each release. Self-hosting for your own use is allowed and unlocks every
feature." New ADR `docs/decisions/0006-license-and-plans.md` records why (solo developer, paid
hosted service, protect against resale as a service, keep the code readable and forkable for
personal use). `package.json` `license` fields → `FSL-1.1-MIT`.

## C. Plans and limits

### Data

```
plans
  user_id            text PK → users.id (cascade)
  source             enum plan_source: subscription | lifetime | manual
  paddle_customer_id text null
  paddle_subscription_id text null
  subscription_status text null                     -- Paddle's status string as received
  current_period_end timestamptz null               -- Pro until here when canceled/past_due
  updated_at         timestamptz

billing_events
  id           text PK                              -- Paddle event_id (idempotency)
  event_type   text
  user_id      text null
  payload      jsonb
  received_at  timestamptz default now()
```

No row in `plans` = Free. The plan is never stored: `getPlan` computes `resolvePlan(row, now)`
on every read, so a canceled subscription expires at `current_period_end` without a job.
`manual` lets the owner grant Pro by SQL (support cases, testers).

### Module `lib/billing/`

- `plan.ts` (server-only): `getPlan(userId): Promise<{ plan; source; currentPeriodEnd; manageable }>`;
  `LIMITS = { free: { games: 3, revisions: 10 }, pro: { games: Infinity, revisions: Infinity } }`;
  `limitsFor(plan)`. When `billingEnabled` is false, `getPlan` returns `pro`/`manual` without a
  query.
- `env`: `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRICE_MONTHLY`,
  `PADDLE_PRICE_LIFETIME`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV`
  (`sandbox` | `production`). `billingEnabled = Boolean(PADDLE_API_KEY && PADDLE_WEBHOOK_SECRET)`.
- `paddle.ts` (pure, testable): `verifyPaddleSignature(rawBody, header, secret, now)`;
  `applyPaddleEvent(current: PlanRow | null, event): PlanRow | null` — maps one event to the
  next plan row; `resolvePlan(row, now): "free" | "pro"`.
- `paddle-api.ts` (server-only): `createPortalSession(customerId)` → URL, via
  `POST https://api.paddle.com/customers/{id}/portal-sessions` (sandbox host when
  `NEXT_PUBLIC_PADDLE_ENV=sandbox`).

### Where the limits bite (data layer, once each)

| Gate         | Where                                                                                    | Behaviour when over                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Active games | `createGame` (covers manual, catalog and import paths), `setGameFlags` when un-archiving | `AppError("Free keeps up to 3 active games. Archive one or upgrade to Pro.")` — thrown before any write; `importFile` fails as a whole. |
| Snapshots    | `createRevision` prune                                                                   | keeps `limitsFor(plan).revisions` most recent; Pro keeps all (prune skipped).                                                           |

Counting is `SELECT count(*) FROM games WHERE user_id = ? AND is_archived = false`, inside the
same transaction as the insert. Existing users over the limit keep what they have; only new
creations are refused. Downgrade (Pro → Free) never deletes: excess games stay, snapshots are
pruned to 10 on the next save of each preset.

### `plan` in responses

`GET /api/companion/me` gains `plan`. The CLI shows it after `csync login`.

## D. Paddle

### Checkout (client)

`components/billing/upgrade-buttons.tsx` loads `https://cdn.paddle.com/paddle/v2/paddle.js`,
calls `Paddle.Initialize({ token, environment })`, and on click
`Paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], customer: { email }, customData: { userId } })`.
Rendered only when `billingEnabled`. After the overlay closes, the page polls `getPlanAction()`
for up to ~30 s and shows "You're on Pro" when the webhook has landed.

### Webhook `POST /api/billing/paddle`

1. Read the raw body; verify `Paddle-Signature` (`ts=…;h1=…`; HMAC-SHA256 of `${ts}:${body}`
   with the secret; timing-safe compare; reject `ts` older than 5 minutes). 401 on failure.
2. Insert into `billing_events` by `event_id`; on conflict → 200 (already processed).
3. Resolve the user: `data.custom_data.userId` (set at checkout; carried onto subscriptions and
   transactions) else look up `plans.paddle_customer_id`. Unknown → store event, log, 200.
4. `applyPaddleEvent` then upsert `plans`. Events handled:
   - `transaction.completed` with an item whose `price.id === PADDLE_PRICE_LIFETIME` →
     `source: lifetime`, customer id stored.
   - `subscription.activated | updated | canceled | past_due | paused | resumed` →
     `source: subscription`, `subscription_status`, `current_period_end =
current_billing_period.ends_at`, customer + subscription ids. Lifetime always wins over
     subscription state.
5. Respond 200 with `{ ok: true }`. Anything thrown → 500 so Paddle retries.

`resolvePlan(row, now)`: `lifetime` or `manual` → pro; subscription with status `active`,
`trialing` or `past_due` → pro (Paddle retries the payment and ends a failed dunning with
`subscription.canceled`, which carries the cutoff); `canceled` → pro while
`current_period_end > now`; otherwise (`paused`, unknown) free.

### Manage subscription

Settings → Plan → "Manage subscription" calls `portalSessionAction()` which creates a Paddle
customer-portal session and redirects. Lifetime owners see "Lifetime — thank you" and no
manage link.

## E. UI

- **`/pricing`** (public, under `app/(marketing)/`): two columns Free / Pro with the feature
  lists from the product decisions, prices, and buttons. Signed out → button goes to
  `/sign-up?next=/pricing`; signed in → checkout overlay. Pro features that don't exist yet
  appear with a "coming soon" tag, never as live.
- **Settings → Plan** (`components/settings-page/plan-card.tsx`): current plan, renewal or
  period end, upgrade buttons, manage link. Hidden entirely when `billingEnabled` is false
  (self-host).
- **Limit hit:** the existing toast shows the sentence; game dialog and import page render a
  link "See plans" to `/pricing` under the error.
- **Header:** small "Pro" badge next to the avatar for Pro users (only when billing enabled).

## Errors and safety

- The webhook is the only writer of `plans` besides SQL; actions never set `plan`.
- Signature failures and unknown users are logged with `[csync:billing]` and no payload
  contents beyond `event_id` and `event_type`.
- `custom_data.userId` is validated as a UUID/user id string ≤ 64 chars before lookup.
- `PADDLE_*` values are server-only except the client token and env, which are public by design.
- Nothing in this sub-project deletes user data on downgrade.

## Testing

- Unit (`tests/billing.test.ts`): signature verify (valid, tampered body, stale ts, malformed
  header); `applyPaddleEvent` for lifetime, activated, canceled-with-period, canceled-immediate,
  past_due, paused, lifetime-then-canceled-subscription; `resolvePlan` boundaries; `limitsFor`.
- Unit: token prefix test updated to `csync_`.
- E2E: Free user creates 3 games, the 4th attempt shows the limit sentence and the pricing
  link (run with `PADDLE_*` set to dummy values so billing is "enabled" without network).
- Manual (needs the owner's Paddle sandbox): checkout monthly → plan flips to Pro → cancel in
  portal → stays Pro until period end; checkout lifetime → Pro with no manage link.
- `pnpm check`, `node --test "companion/test/**/*.test.mjs"`, `pnpm test:e2e`, prettier.

## Sequence

1. Rebrand (mechanical, one commit; CI proves nothing broke).
2. License + ADR.
3. Schema + migration; `lib/billing/plan.ts`; gates in `createGame`, `setGameFlags`,
   `createRevision`; `plan` on `/api/companion/me`.
4. Pure Paddle module + tests; webhook route; portal action.
5. `/pricing`, Plan card, badge, limit toasts.
6. Docs (`docs/billing.md`, self-hosting note "leave PADDLE_* unset"), e2e, `.env.example`.
