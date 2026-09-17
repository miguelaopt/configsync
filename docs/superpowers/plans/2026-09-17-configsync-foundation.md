# ConfigSync Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product to ConfigSync, relicense under FSL-1.1-MIT, add a Free/Pro plan with two Free limits, and wire Paddle checkout + webhooks so Pro can be bought monthly or lifetime.

**Architecture:** `plans` rows are written only by the Paddle webhook (or SQL); `getPlan(userId)` computes free/pro at read time from that row and is the single entitlement source. Two data-layer gates (`createGame`, `createRevision`) consult `limitsFor(plan)`. When `PADDLE_*` is unset, everyone is Pro and all billing UI is hidden, which keeps self-hosting whole.

**Tech Stack:** Next.js 16 App Router, Drizzle/Postgres, Zod 4, Vitest, Playwright, Paddle Billing (Paddle.js v2 overlay + webhooks), plain Node ESM for the CLI.

**Spec:** `docs/superpowers/specs/2026-09-17-configsync-foundation-design.md`

## Global Constraints

- Name: **ConfigSync**. CLI **`csync`**. Token prefix **`csync_`**. Config **`~/.config/csync/config.json`**.
- License: **FSL-1.1-MIT**, licensor "Miguel Ferreira".
- Free limits: **3 active (non-archived) games**, **10 snapshots per preset**. Pro: unlimited.
- `billingEnabled = Boolean(PADDLE_API_KEY && PADDLE_WEBHOOK_SECRET)`; disabled ⇒ every user is Pro, billing UI hidden.
- The webhook is the only code path that writes `plans`. Actions never set a plan.
- Limit error sentence, verbatim: `Free keeps up to 3 active games. Archive one or upgrade to Pro.`
- Downgrade never deletes data.
- Existing patterns: `runAction()` in `lib/actions/shared.ts`; data functions take `userId` first; UI primitives from `components/ui`; user-facing errors are sentences; `AppError` for messages safe to show.
- `pnpm check` (typecheck + lint + unit) before every commit; commit messages end with the attribution line from the session reminder.
- Branch: `feat/configsync-foundation` (stacked on `feat/catalog-companion`).

---

## File map

| Path                                                  | Responsibility                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `LICENSE`, `docs/decisions/0006-license-and-plans.md` | FSL text; why source-available + paid hosted tiers                             |
| `lib/db/schema.ts`, `drizzle/0002_plans.sql`          | `plans`, `billing_events` tables, `plan_source` enum                           |
| `lib/env.ts`                                          | `PADDLE_*` optional vars, `billingEnabled`                                     |
| `lib/billing/public.ts`                               | Client-safe constants: Paddle client token/env, price display strings          |
| `lib/billing/paddle.ts`                               | Pure: `verifyPaddleSignature`, `applyPaddleEvent`, `resolvePlan`, event schema |
| `lib/billing/plan.ts`                                 | Server: `getPlan(userId)`, `LIMITS`, `limitsFor`, `assertCanAddGame`           |
| `lib/billing/paddle-api.ts`                           | Server: `createPortalSession(customerId)`                                      |
| `lib/data/billing.ts`                                 | `getPlanRow`, `upsertPlanRow`, `recordBillingEvent`, `findUserIdByCustomer`    |
| `lib/actions/billing.ts`                              | `getPlanAction`, `portalSessionAction`                                         |
| `app/api/billing/paddle/route.ts`                     | Webhook                                                                        |
| `app/(marketing)/layout.tsx`, `pricing/page.tsx`      | Public pricing page                                                            |
| `components/billing/upgrade-buttons.tsx`              | Paddle.js overlay + post-checkout polling                                      |
| `components/billing/pricing-table.tsx`                | Free vs Pro columns                                                            |
| `components/settings-page/plan-card.tsx`              | Current plan, upgrade, manage                                                  |
| `components/ui/toaster.tsx`                           | `toastError(message)` — adds a "See plans" action on limit errors              |
| `tests/billing.test.ts`                               | Signature, event mapping, plan resolution, limits                              |
| `docs/billing.md`                                     | Owner setup for Paddle                                                         |

---

## Task 1: Rebrand to ConfigSync / csync

**Files:**

- Modify: `lib/auth/companion-token.ts`, `lib/auth/companion.ts`, `lib/auth/index.ts` (appName, subject, cookiePrefix), `lib/env.ts` (EMAIL_FROM default), `lib/site.ts`, `lib/db/schema.ts` (header comment), `components/app/logo.tsx`, `components/app/shell.tsx`, `app/(auth)/layout.tsx`, `app/(app)/settings/page.tsx`, `components/settings-page/companion-card.tsx`, `package.json`, `companion/package.json`, `companion/README.md`, `companion/lib/config.mjs`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/**/*.md`, `.env.example`, `e2e/vault.spec.ts`, `scripts/*.ts`, `tests/companion-tokens.test.ts`
- Rename: `companion/bin/gsv.mjs` → `companion/bin/csync.mjs`

**Interfaces:**

- Produces: token prefix `csync_` (checked by `userIdForToken`); CLI command `csync`; root script `pnpm csync`.

- [ ] **Step 1: Failing test** — in `tests/companion-tokens.test.ts` change the regex:

```ts
expect(token).toMatch(/^csync_[A-Za-z0-9_-]{43}$/);
```

Run: `pnpm vitest run tests/companion-tokens.test.ts` → FAIL (token still starts with `gsv_`).

- [ ] **Step 2: Token prefix** — `lib/auth/companion-token.ts`:

```ts
const token = `csync_${randomBytes(32).toString("base64url")}`;
```

`lib/data/companion-tokens.ts`: `if (!token.startsWith("csync_")) return null;`. `lib/auth/companion.ts`: doc comment `Bearer csync_…` and message ``"Invalid or revoked companion token. Run `csync login` again."``.

Run the test → PASS.

- [ ] **Step 3: Mechanical rename** — run from the repo root, then review `git diff`:

```bash
git mv companion/bin/gsv.mjs companion/bin/csync.mjs
grep -rIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=drizzle \
  -e "GameSettings Vault" -e "gamesettings-vault" -e "gsv" . \
  | grep -v -e "^./docs/superpowers/" -e "^./docs/decisions/000[1-5]" -e "^./CHANGELOG.md" \
  | xargs sed -i \
    -e 's/GameSettings Vault/ConfigSync/g' \
    -e 's/gamesettings-vault\/gamesettings-vault/miguelaopt\/configsync/g' \
    -e 's/gsv-companion/csync/g' \
    -e 's#companion/bin/gsv\.mjs#companion/bin/csync.mjs#g' \
    -e 's#bin/gsv\.mjs#bin/csync.mjs#g' \
    -e 's/\bgsv login\b/csync login/g; s/\bgsv scan\b/csync scan/g; s/\bgsv games\b/csync games/g; s/\bgsv import\b/csync import/g; s/\bgsv apply\b/csync apply/g' \
    -e 's/`gsv`/`csync`/g; s/`gsv /`csync /g; s/pnpm gsv/pnpm csync/g' \
    -e 's/"gsv": /"csync": /g' \
    -e 's/\[gsv:/[csync:/g' \
    -e 's/cookiePrefix: "gsv"/cookiePrefix: "csync"/'
```

**Do not** rename the string `"gamesettings-vault"` where it is the interchange `format` id
(`lib/import-export/schema.ts`, `serialize.ts`, `lib/data/catalog.ts`, tests, fixtures,
`docs/import-export.md`): that value is the documented, stable file-format identifier and
changing it would break every existing export. Only the _package/repo_ uses change:

Then fix by hand what `sed` cannot know:

- `package.json` `"name": "configsync"`; `README.md` clone line `git clone https://github.com/miguelaopt/configsync && cd configsync`; `lib/site.ts` `repoUrl` default `https://github.com/miguelaopt/configsync` (the sed above already did this one).

- `companion/lib/config.mjs`: `join(base, "csync", "config.json")`.
- `companion/bin/csync.mjs`: `HELP` first line `csync — ConfigSync companion`, every `gsv` in the usage lines and in `console.error("Not logged in. Run: csync login <url>")`.
- `companion/package.json`: `"bin": { "csync": "./bin/csync.mjs" }`, description "ConfigSync companion: …".
- `components/app/logo.tsx`: wordmark `Config<span className="text-accent">Sync</span>`.
- `proxy.ts`: `getSessionCookie(request, { cookiePrefix: "csync" })`.
- `lib/db/schema.ts` first comment line: `Database schema — ConfigSync.`
- `README.md` title `# ConfigSync`; the Quick start `git clone` URL → `https://github.com/miguelaopt/configsync && cd configsync`.
- `docs/companion.md`, `companion/README.md`: `~/.config/csync/config.json`, `%APPDATA%\csync\config.json`, `git clone <repo> && cd configsync/companion`.
- `.env.example` header comment and `EMAIL_FROM="ConfigSync <noreply@example.com>"`.
- `docs/decisions/README.md` stays; ADRs 0001–0005 stay as history.
- The `Claude-Session`/attribution lines in old commits are history; nothing to do.

Leave `postgres://gsv:gsv@…/gsv` (database credentials) untouched everywhere — the DB name is not part of the brand.

- [ ] **Step 4: Check for leftovers**

```bash
grep -rIn --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git -e "GameSettings" -e "gamesettings" -e "\bgsv\b" . \
  | grep -v -e "docs/superpowers/" -e "docs/decisions/000[1-5]" -e "postgres://gsv" -e "CHANGELOG" -e "gsv:gsv" -e "POSTGRES_" -e '"gamesettings-vault"' -e "format.*gamesettings-vault"
```

Expected: no output (or only historical files). `pnpm test` must still pass — the import/export tests assert the `gamesettings-vault` format id. `ls ~/.config/gsv` is local state, not repo — delete it or re-login later.

- [ ] **Step 5: Verify** — `pnpm check` PASS; `node --test "companion/test/**/*.test.mjs"` PASS; `pnpm csync` prints help starting with `csync — ConfigSync companion`; `pnpm exec prettier --check .` PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor: rename GameSettings Vault to ConfigSync; companion CLI is csync"
```

---

## Task 2: License → FSL-1.1-MIT, ADR 0006

**Files:**

- Replace: `LICENSE`
- Create: `docs/decisions/0006-license-and-plans.md`
- Modify: `docs/decisions/README.md`, `README.md` (License section + "Every dependency is open source" line), `package.json` + `companion/package.json` (`"license": "FSL-1.1-MIT"`), `app/(app)/settings/page.tsx:49`, `components/app/shell.tsx:106`, `app/(auth)/layout.tsx:16`, `CONTRIBUTING.md` (ground rules mention MIT?)

- [ ] **Step 1: License text**

```bash
curl -sL https://fsl.software/FSL-1.1-MIT.template.md \
  | sed -e 's/\${year}/2026/' -e 's/\${licensor name}/Miguel Ferreira/' > LICENSE
head -8 LICENSE
```

Expected first lines: `# Functional Source License, Version 1.1, MIT Future License` … `Copyright 2026 Miguel Ferreira`. If the URL is unreachable, take the text from https://fsl.software/ (FSL-1.1-MIT) — it must be the canonical text, not paraphrased.

- [ ] **Step 2: ADR** — `docs/decisions/0006-license-and-plans.md`:

```markdown
# 0006 — Source-available license and a paid hosted plan

**Status:** accepted · 2026-09-17

## Context

ConfigSync is built by one person and will be offered as a hosted service with a Free plan and a
paid Pro plan (monthly or lifetime). Under MIT anyone could take the code and run a competing
paid service. At the same time the code should stay readable, forkable and self-hostable for
personal use — that is part of the product's trust story.

## Decision

- License the whole repository under **FSL-1.1-MIT** (Functional Source License). Anyone may
  use, modify and self-host it for their own purposes; offering it as a competing commercial
  service is not permitted. Each version converts to MIT two years after its release.
- Plans are enforced **only by the hosted server**. `PADDLE_*` unset ⇒ every user is Pro.
  Self-hosters get everything; the hosted convenience is what is sold.
- Paddle (merchant of record) handles payment, EU VAT and invoices. The server stores no card
  data and only the Paddle customer/subscription ids needed to map webhooks to users.

## Consequences

- README and footers say "source-available", not "open source".
- Feature gates live in `lib/billing/plan.ts` and the data layer, never in the client.
- Contributors' changes are licensed under the same terms (CONTRIBUTING).
```

Add to `docs/decisions/README.md`: `| 0006 | [Source-available license and a paid hosted plan](0006-license-and-plans.md) |`.

- [ ] **Step 3: Wording** —

- `README.md` License section: `[FSL-1.1-MIT](LICENSE) — source-available. Use it, modify it, self-host it for yourself; don't resell it as a service. Each version becomes MIT two years after release. See [ADR 0006](docs/decisions/0006-license-and-plans.md).`
- `README.md` line "Every dependency is open source. There is no proprietary backend." → "Every dependency is open source. Self-hosting unlocks every feature; the hosted service at configsync sells convenience, not code."
- `app/(app)/settings/page.tsx`: `ConfigSync {SITE.version} · source-available under the FSL ·`
- `components/app/shell.tsx:106`: `Source-available · self-hostable.`
- `app/(auth)/layout.tsx:16`: `Source-available · self-hostable · your data stays yours.`
- `package.json` and `companion/package.json`: `"license": "FSL-1.1-MIT"`.
- `CONTRIBUTING.md`, under Ground rules, add: `By contributing you agree your changes are licensed under the repository's FSL-1.1-MIT terms.`

- [ ] **Step 4: Verify** — `pnpm check` PASS; `pnpm exec prettier --check .` PASS; `grep -rn "MIT license" --exclude-dir=node_modules .` returns nothing outside `LICENSE`/ADRs.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: relicense under FSL-1.1-MIT; ADR 0006 on license and plans"
```

---

## Task 3: Plans schema, `getPlan`, limits and gates

**Files:**

- Modify: `lib/db/schema.ts` (after `deviceGames`), `lib/env.ts`, `lib/data/games.ts` (`createGame`, `setGameFlags`), `lib/data/revisions.ts`, `app/api/companion/me/route.ts`
- Create: `drizzle/0002_plans.sql` (generated), `lib/billing/plan.ts`, `lib/data/billing.ts`
- Test: `tests/billing.test.ts` (limits part)

**Interfaces:**

- Produces:
  - `type Plan = "free" | "pro"`; `type PlanSource = "subscription" | "lifetime" | "manual"`.
  - `type PlanRow = { userId: string; source: PlanSource; paddleCustomerId: string | null; paddleSubscriptionId: string | null; subscriptionStatus: string | null; currentPeriodEnd: Date | null }`.
  - `resolvePlan(row: PlanRow | null, now?: Date): Plan` (pure, in `lib/billing/paddle.ts` — created here as a stub file, filled in Task 4).
  - `LIMITS: Record<Plan, { games: number; revisions: number }>`; `limitsFor(plan): { games; revisions }`.
  - `getPlan(userId): Promise<{ plan: Plan; source: PlanSource | null; currentPeriodEnd: Date | null; paddleCustomerId: string | null }>`.
  - `assertCanAddGame(userId, tx)`: throws the limit `AppError` when Free and active games ≥ 3.
  - `billingEnabled: boolean` from `lib/env.ts`.
  - Data: `getPlanRow(userId): Promise<PlanRow | null>`.

- [ ] **Step 1: Failing test** — create `tests/billing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { limitsFor, LIMITS } from "@/lib/billing/limits";
import { resolvePlan, type PlanRow } from "@/lib/billing/paddle";

const row = (over: Partial<PlanRow>): PlanRow => ({
  userId: "u1",
  source: "subscription",
  paddleCustomerId: "ctm_1",
  paddleSubscriptionId: "sub_1",
  subscriptionStatus: "active",
  currentPeriodEnd: null,
  ...over,
});
const now = new Date("2026-09-17T12:00:00Z");

describe("limits", () => {
  it("free is 3 games and 10 snapshots; pro is unlimited", () => {
    expect(limitsFor("free")).toEqual({ games: 3, revisions: 10 });
    expect(limitsFor("pro")).toEqual({ games: Infinity, revisions: Infinity });
    expect(LIMITS.free.games).toBe(3);
  });
});

describe("resolvePlan", () => {
  it("no row is free; lifetime and manual are pro regardless of subscription state", () => {
    expect(resolvePlan(null, now)).toBe("free");
    expect(resolvePlan(row({ source: "lifetime", subscriptionStatus: "canceled" }), now)).toBe(
      "pro",
    );
    expect(resolvePlan(row({ source: "manual", subscriptionStatus: null }), now)).toBe("pro");
  });
  it("active, trialing and past_due subscriptions are pro", () => {
    for (const s of ["active", "trialing", "past_due"])
      expect(resolvePlan(row({ subscriptionStatus: s }), now)).toBe("pro");
  });
  it("canceled stays pro until the period ends, then free", () => {
    const later = new Date("2026-10-01T00:00:00Z");
    expect(resolvePlan(row({ subscriptionStatus: "canceled", currentPeriodEnd: later }), now)).toBe(
      "pro",
    );
    expect(
      resolvePlan(row({ subscriptionStatus: "canceled", currentPeriodEnd: later }), later),
    ).toBe("free");
    expect(resolvePlan(row({ subscriptionStatus: "canceled", currentPeriodEnd: null }), now)).toBe(
      "free",
    );
    expect(resolvePlan(row({ subscriptionStatus: "paused", currentPeriodEnd: later }), now)).toBe(
      "free",
    );
  });
});
```

Run: `pnpm vitest run tests/billing.test.ts` → FAIL (modules missing).

- [ ] **Step 2: `lib/billing/limits.ts`** (pure, no server-only, so tests and client can import):

```ts
export type Plan = "free" | "pro";

/** The two things Free caps. Everything else is gated by `plan === "pro"` where it applies. */
export const LIMITS: Record<Plan, { games: number; revisions: number }> = {
  free: { games: 3, revisions: 10 },
  pro: { games: Infinity, revisions: Infinity },
};

export const limitsFor = (plan: Plan) => LIMITS[plan];

export const GAME_LIMIT_MESSAGE = `Free keeps up to ${LIMITS.free.games} active games. Archive one or upgrade to Pro.`;
```

- [ ] **Step 3: `lib/billing/paddle.ts` (resolvePlan only for now)**:

```ts
import type { Plan } from "./limits";

export type PlanSource = "subscription" | "lifetime" | "manual";
export type PlanRow = {
  userId: string;
  source: PlanSource;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
};

/** Plan at `now`, derived from the stored row. Never stored: a canceled sub expires by itself. */
export function resolvePlan(row: PlanRow | null, now = new Date()): Plan {
  if (!row) return "free";
  if (row.source === "lifetime" || row.source === "manual") return "pro";
  switch (row.subscriptionStatus) {
    case "active":
    case "trialing":
    case "past_due": // Paddle keeps retrying; a final failure arrives as subscription.canceled
      return "pro";
    case "canceled":
      return row.currentPeriodEnd && row.currentPeriodEnd > now ? "pro" : "free";
    default:
      return "free";
  }
}
```

Run the test → PASS.

- [ ] **Step 4: Schema** — append to `lib/db/schema.ts` after `deviceGames` (before the Relations section):

```ts
// ---------------------------------------------------------------------------
// Billing (written only by the Paddle webhook — see lib/billing)
// ---------------------------------------------------------------------------

export const planSource = pgEnum("plan_source", ["subscription", "lifetime", "manual"]);

export const plans = pgTable("plans", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  source: planSource("source").notNull(),
  paddleCustomerId: text("paddle_customer_id"),
  paddleSubscriptionId: text("paddle_subscription_id"),
  /** Paddle's status string as received: active, trialing, past_due, paused, canceled. */
  subscriptionStatus: text("subscription_status"),
  /** Pro lasts until here when the subscription is canceled. */
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** Every webhook we accepted, keyed by Paddle's event id so retries are no-ops. */
export const billingEvents = pgTable("billing_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  userId: text("user_id"),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PlanRowSelect = typeof plans.$inferSelect;
```

Generate the migration: `pnpm db:generate` → creates `drizzle/0002_<name>.sql`; rename to `drizzle/0002_plans.sql` **and** update the `tag` for entry `idx: 2` in `drizzle/meta/_journal.json` to `0002_plans`. Expected SQL: `CREATE TYPE "public"."plan_source" …`, `CREATE TABLE "plans" (…)`, `CREATE TABLE "billing_events" (…)`, and the FK to `users`. Apply: `pnpm db:migrate`.

- [ ] **Step 5: Env** — `lib/env.ts` schema additions:

```ts
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_PRICE_MONTHLY: z.string().optional(),
  PADDLE_PRICE_LIFETIME: z.string().optional(),
```

In `load()`, normalise empty strings like the others:

```ts
    PADDLE_API_KEY: process.env.PADDLE_API_KEY || undefined,
    PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET || undefined,
    PADDLE_PRICE_MONTHLY: process.env.PADDLE_PRICE_MONTHLY || undefined,
    PADDLE_PRICE_LIFETIME: process.env.PADDLE_PRICE_LIFETIME || undefined,
```

After `env`: `export const billingEnabled = Boolean(env.PADDLE_API_KEY && env.PADDLE_WEBHOOK_SECRET);`

- [ ] **Step 6: `lib/data/billing.ts`**:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { PlanRow } from "@/lib/billing/paddle";

const { plans, billingEvents, users } = schema;

export async function getPlanRow(userId: string): Promise<PlanRow | null> {
  const row = await db.query.plans.findFirst({ where: eq(plans.userId, userId) });
  return row ?? null;
}

export async function upsertPlanRow(row: PlanRow) {
  const { userId, ...rest } = row;
  await db
    .insert(plans)
    .values({ userId, ...rest })
    .onConflictDoUpdate({ target: plans.userId, set: rest });
}

/** True when stored now; false when this event id was already seen (Paddle retried). */
export async function recordBillingEvent(event: {
  event_id: string;
  event_type: string;
  userId: string | null;
  payload: unknown;
}) {
  const inserted = await db
    .insert(billingEvents)
    .values({
      id: event.event_id,
      eventType: event.event_type,
      userId: event.userId,
      payload: event.payload as object,
    })
    .onConflictDoNothing()
    .returning({ id: billingEvents.id });
  return inserted.length > 0;
}

export async function findUserIdByCustomer(paddleCustomerId: string) {
  const row = await db.query.plans.findFirst({
    where: eq(plans.paddleCustomerId, paddleCustomerId),
    columns: { userId: true },
  });
  return row?.userId ?? null;
}

export async function userExists(userId: string) {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true },
  });
  return Boolean(row);
}
```

`db.query.plans` requires `plans` in the Drizzle schema object passed to `drizzle()` — check `lib/db/index.ts` passes `schema` as a whole (`import * as schema`); if it enumerates tables, add `plans` and `billingEvents`.

- [ ] **Step 7: `lib/billing/plan.ts`**:

```ts
import "server-only";
import { cache } from "react";
import { and, count, eq } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { billingEnabled } from "@/lib/env";
import { AppError } from "@/lib/data/errors";
import { getPlanRow } from "@/lib/data/billing";
import { GAME_LIMIT_MESSAGE, limitsFor, type Plan } from "./limits";
import { resolvePlan, type PlanSource } from "./paddle";

export type PlanInfo = {
  plan: Plan;
  source: PlanSource | null;
  currentPeriodEnd: Date | null;
  paddleCustomerId: string | null;
  subscriptionStatus: string | null;
};

/** The one place that answers "is this user Pro?". Self-host (no Paddle) ⇒ everyone is. */
export const getPlan = cache(async (userId: string): Promise<PlanInfo> => {
  if (!billingEnabled)
    return {
      plan: "pro",
      source: "manual",
      currentPeriodEnd: null,
      paddleCustomerId: null,
      subscriptionStatus: null,
    };
  const row = await getPlanRow(userId);
  return {
    plan: resolvePlan(row),
    source: row?.source ?? null,
    currentPeriodEnd: row?.currentPeriodEnd ?? null,
    paddleCustomerId: row?.paddleCustomerId ?? null,
    subscriptionStatus: row?.subscriptionStatus ?? null,
  };
});

/** Throws before any write when a Free user already has the maximum of active games. */
export async function assertCanAddGame(userId: string, tx: Tx | typeof db = db) {
  const { plan } = await getPlan(userId);
  const max = limitsFor(plan).games;
  if (max === Infinity) return;
  const [row] = await tx
    .select({ n: count() })
    .from(schema.games)
    .where(and(eq(schema.games.userId, userId), eq(schema.games.isArchived, false)));
  if ((row?.n ?? 0) >= max) throw new AppError(GAME_LIMIT_MESSAGE, "forbidden");
}
```

- [ ] **Step 8: Gates** —

`lib/data/games.ts` `createGame`: first line `await assertCanAddGame(userId, tx);` (import from `@/lib/billing/plan`). `setGameFlags`: before the update, `if (flags.isArchived === false) await assertCanAddGame(userId);` — un-archiving brings a game back into the active count. (A game that is already active being "un-archived" again is a no-op in the UI, so the over-count is acceptable.)

`lib/data/revisions.ts` `createRevision`: replace the constant with a per-plan limit:

```ts
  const keep = limitsFor((await getPlan(userId)).plan).revisions;
  …
    if (keep !== Infinity) {
      const stale = await tx …  .offset(keep);
      if (stale.length > 0) await tx.delete(revisions).where(inArray(revisions.id, stale.map((r) => r.id)));
    }
```

Delete `KEEP_PER_PRESET` and its other use in `listRevisions` (`.limit(KEEP_PER_PRESET)` → `.limit(200)` — a display cap, not a plan rule; comment it as such).

`app/api/companion/me/route.ts`: add `plan: (await getPlan(userId)).plan` to the response.

- [ ] **Step 9: Verify** — `pnpm check` PASS. Manual with billing disabled (no `PADDLE_*` in `.env`): create a 4th game → works. Then add to `.env` temporarily `PADDLE_API_KEY=x` and `PADDLE_WEBHOOK_SECRET=x`, restart dev, as the demo user (who has > 3 games) try Add game → toast `Free keeps up to 3 active games. Archive one or upgrade to Pro.`; archive one game (still > 3) → still refused; `curl -H "Authorization: Bearer <token>" localhost:3000/api/companion/me` shows `"plan":"free"`. Remove the temporary vars.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(billing): plans table, getPlan, Free limits on active games and snapshots"
```

---

## Task 4: Paddle — signature, event mapping, webhook, portal

**Files:**

- Modify: `lib/billing/paddle.ts` (add `verifyPaddleSignature`, `paddleEventSchema`, `applyPaddleEvent`), `tests/billing.test.ts`
- Create: `lib/billing/paddle-api.ts`, `app/api/billing/paddle/route.ts`, `lib/actions/billing.ts`

**Interfaces:**

- Produces:
  - `verifyPaddleSignature(rawBody: string, header: string | null, secret: string, nowMs?: number): boolean`
  - `paddleEventSchema` (Zod) → `PaddleEvent = { event_id; event_type; data: { id; status?; customer_id?; subscription_id?; custom_data?: { userId?: string } | null; current_billing_period?: { ends_at: string } | null; items?: { price: { id: string } }[] } }`
  - `applyPaddleEvent(current: PlanRow | null, event: PaddleEvent, userId: string, lifetimePriceId: string): PlanRow | null` — `null` means "no change".
  - `createPortalSession(customerId: string): Promise<string>` (URL).
  - Actions: `getPlanAction()` → `PlanInfo`; `portalSessionAction()` → `{ url }`.

- [ ] **Step 1: Failing tests** — append to `tests/billing.test.ts` (the two imports go at the top of the file, next to the existing ones; `row` and `now` are the helpers already defined there):

```ts
import { createHmac } from "node:crypto";
import { applyPaddleEvent, verifyPaddleSignature } from "@/lib/billing/paddle";

const secret = "whsec_test";
const sign = (body: string, ts: number) =>
  `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;

describe("verifyPaddleSignature", () => {
  const body = '{"event_id":"evt_1"}';
  const ts = Math.floor(now.getTime() / 1000);
  it("accepts a valid signature and rejects tampering, staleness and junk", () => {
    expect(verifyPaddleSignature(body, sign(body, ts), secret, now.getTime())).toBe(true);
    expect(verifyPaddleSignature(body + " ", sign(body, ts), secret, now.getTime())).toBe(false);
    expect(verifyPaddleSignature(body, sign(body, ts - 600), secret, now.getTime())).toBe(false);
    expect(verifyPaddleSignature(body, "nonsense", secret, now.getTime())).toBe(false);
    expect(verifyPaddleSignature(body, null, secret, now.getTime())).toBe(false);
  });
  it("accepts any of several h1 values during secret rotation", () => {
    const good = sign(body, ts);
    expect(verifyPaddleSignature(body, `${good};h1=deadbeef`, secret, now.getTime())).toBe(true);
  });
});

describe("applyPaddleEvent", () => {
  const LIFETIME = "pri_life";
  const sub = (type: string, status: string, endsAt: string | null = "2026-10-17T12:00:00Z") => ({
    event_id: "evt_x",
    event_type: type,
    data: {
      id: "sub_1",
      status,
      customer_id: "ctm_1",
      custom_data: { userId: "u1" },
      current_billing_period: endsAt ? { ends_at: endsAt } : null,
    },
  });
  it("lifetime transaction sets source lifetime and keeps the customer id", () => {
    const next = applyPaddleEvent(
      null,
      {
        event_id: "evt_1",
        event_type: "transaction.completed",
        data: {
          id: "txn_1",
          customer_id: "ctm_1",
          custom_data: { userId: "u1" },
          items: [{ price: { id: LIFETIME } }],
        },
      },
      "u1",
      LIFETIME,
    );
    expect(next).toMatchObject({ userId: "u1", source: "lifetime", paddleCustomerId: "ctm_1" });
  });
  it("a subscription transaction is a no-op (subscription events carry the state)", () => {
    const next = applyPaddleEvent(
      null,
      {
        event_id: "evt_2",
        event_type: "transaction.completed",
        data: {
          id: "txn_2",
          customer_id: "ctm_1",
          subscription_id: "sub_1",
          items: [{ price: { id: "pri_month" } }],
        },
      },
      "u1",
      LIFETIME,
    );
    expect(next).toBeNull();
  });
  it("subscription events set status, ids and period end", () => {
    const next = applyPaddleEvent(null, sub("subscription.activated", "active"), "u1", LIFETIME);
    expect(next).toEqual({
      userId: "u1",
      source: "subscription",
      paddleCustomerId: "ctm_1",
      paddleSubscriptionId: "sub_1",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date("2026-10-17T12:00:00Z"),
    });
    const canceled = applyPaddleEvent(
      next,
      sub("subscription.canceled", "canceled", null),
      "u1",
      LIFETIME,
    );
    expect(canceled).toMatchObject({ subscriptionStatus: "canceled", currentPeriodEnd: null });
  });
  it("lifetime wins: a later canceled subscription keeps source lifetime", () => {
    const life = row({ source: "lifetime", subscriptionStatus: null, paddleSubscriptionId: null });
    const next = applyPaddleEvent(
      life,
      sub("subscription.canceled", "canceled", null),
      "u1",
      LIFETIME,
    );
    expect(next).toMatchObject({
      source: "lifetime",
      subscriptionStatus: "canceled",
      paddleSubscriptionId: "sub_1",
    });
  });
  it("ignores unrelated event types", () => {
    expect(
      applyPaddleEvent(
        null,
        { event_id: "e", event_type: "customer.updated", data: { id: "ctm_1" } },
        "u1",
        LIFETIME,
      ),
    ).toBeNull();
  });
});
```

Run → FAIL (functions missing).

- [ ] **Step 2: Implement in `lib/billing/paddle.ts`** (append):

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** `Paddle-Signature: ts=<unix>;h1=<hex>[;h1=<hex>]` over `${ts}:${rawBody}`. 5-minute skew window. */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!header) return false;
  const parts = header.split(";").map((p) => p.split("=", 2) as [string, string | undefined]);
  const ts = parts.find(([k]) => k === "ts")?.[1];
  const h1s = parts.filter(([k]) => k === "h1").map(([, v]) => v ?? "");
  if (!ts || !/^\d+$/.test(ts) || h1s.length === 0) return false;
  if (Math.abs(nowMs / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  return h1s.some(
    (h) => h.length === expected.length && timingSafeEqual(Buffer.from(h), Buffer.from(expected)),
  );
}

export const paddleEventSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  data: z.object({
    id: z.string(),
    status: z.string().optional(),
    customer_id: z.string().nullish(),
    subscription_id: z.string().nullish(),
    custom_data: z.object({ userId: z.string().min(1).max(64).optional() }).nullish(),
    current_billing_period: z.object({ ends_at: z.string() }).nullish(),
    items: z.array(z.object({ price: z.object({ id: z.string() }) })).optional(),
  }),
});
export type PaddleEvent = z.infer<typeof paddleEventSchema>;

/** Next plan row after one event; null = nothing to store. Lifetime is never downgraded. */
export function applyPaddleEvent(
  current: PlanRow | null,
  event: PaddleEvent,
  userId: string,
  lifetimePriceId: string,
): PlanRow | null {
  const d = event.data;
  if (event.event_type === "transaction.completed") {
    if (!d.items?.some((i) => i.price.id === lifetimePriceId)) return null;
    return {
      userId,
      source: "lifetime",
      paddleCustomerId: d.customer_id ?? current?.paddleCustomerId ?? null,
      paddleSubscriptionId: current?.paddleSubscriptionId ?? null,
      subscriptionStatus: current?.subscriptionStatus ?? null,
      currentPeriodEnd: current?.currentPeriodEnd ?? null,
    };
  }
  if (!event.event_type.startsWith("subscription.")) return null;
  return {
    userId,
    source: current?.source === "lifetime" ? "lifetime" : "subscription",
    paddleCustomerId: d.customer_id ?? current?.paddleCustomerId ?? null,
    paddleSubscriptionId: d.id,
    subscriptionStatus: d.status ?? current?.subscriptionStatus ?? null,
    currentPeriodEnd: d.current_billing_period ? new Date(d.current_billing_period.ends_at) : null,
  };
}
```

Run `pnpm vitest run tests/billing.test.ts` → PASS.

- [ ] **Step 3: `lib/billing/paddle-api.ts`**:

```ts
import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/data/errors";

const base =
  process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";

/** Authenticated link to Paddle's customer portal (manage/cancel subscription, invoices). */
export async function createPortalSession(customerId: string): Promise<string> {
  const res = await fetch(`${base}/customers/${customerId}/portal-sessions`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.PADDLE_API_KEY}`, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error("[csync:billing] portal session failed", res.status);
    throw new AppError("Couldn't open the billing portal right now. Try again in a minute.");
  }
  const json = (await res.json()) as { data?: { urls?: { general?: { overview?: string } } } };
  const url = json.data?.urls?.general?.overview;
  if (!url)
    throw new AppError("Couldn't open the billing portal right now. Try again in a minute.");
  return url;
}
```

- [ ] **Step 4: Webhook `app/api/billing/paddle/route.ts`**:

```ts
import { NextResponse } from "next/server";
import { billingEnabled, env } from "@/lib/env";
import { applyPaddleEvent, paddleEventSchema, verifyPaddleSignature } from "@/lib/billing/paddle";
import {
  findUserIdByCustomer,
  getPlanRow,
  recordBillingEvent,
  upsertPlanRow,
  userExists,
} from "@/lib/data/billing";

/** Paddle → us. Verified, idempotent, and the only writer of `plans`. */
export async function POST(req: Request) {
  if (!billingEnabled) return NextResponse.json({ error: "Billing is off." }, { status: 404 });
  const raw = await req.text();
  if (!verifyPaddleSignature(raw, req.headers.get("paddle-signature"), env.PADDLE_WEBHOOK_SECRET!))
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }
  const parsed = paddleEventSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "Unexpected event shape." }, { status: 400 });
  const event = parsed.data;

  const fromCustomData = event.data.custom_data?.userId;
  const userId =
    (fromCustomData && (await userExists(fromCustomData)) ? fromCustomData : null) ??
    (event.data.customer_id ? await findUserIdByCustomer(event.data.customer_id) : null);

  const fresh = await recordBillingEvent({
    event_id: event.event_id,
    event_type: event.event_type,
    userId,
    payload: json,
  });
  if (!fresh) return NextResponse.json({ ok: true, duplicate: true });
  if (!userId) {
    console.warn("[csync:billing] no user for event", event.event_id, event.event_type);
    return NextResponse.json({ ok: true, unmatched: true });
  }

  const next = applyPaddleEvent(
    await getPlanRow(userId),
    event,
    userId,
    env.PADDLE_PRICE_LIFETIME ?? "",
  );
  if (next) await upsertPlanRow(next);
  return NextResponse.json({ ok: true });
}
```

Any thrown error (DB down) propagates → Next returns 500 → Paddle retries. `proxy.ts` already excludes `/api`.

- [ ] **Step 5: Actions `lib/actions/billing.ts`**:

```ts
"use server";
import { z } from "zod";
import { getPlan } from "@/lib/billing/plan";
import { createPortalSession } from "@/lib/billing/paddle-api";
import { AppError } from "@/lib/data/errors";
import { runAction } from "./shared";

export async function getPlanAction() {
  return runAction(z.null(), null, (_v, userId) => getPlan(userId));
}

export async function portalSessionAction() {
  return runAction(z.null(), null, async (_v, userId) => {
    const { paddleCustomerId } = await getPlan(userId);
    if (!paddleCustomerId) throw new AppError("There's no subscription to manage on this account.");
    return { url: await createPortalSession(paddleCustomerId) };
  });
}
```

- [ ] **Step 6: Verify** — `pnpm check` PASS. Webhook by hand (dev server, `.env` with `PADDLE_API_KEY=x`, `PADDLE_WEBHOOK_SECRET=whsec_test`, `PADDLE_PRICE_LIFETIME=pri_life`):

```bash
U=http://localhost:3000; UID=$(docker exec settings_saver-db-1 psql "$DATABASE_URL" -tAc "select id from users where email='demo@example.com'")
BODY=$(printf '{"event_id":"evt_manual_1","event_type":"subscription.activated","data":{"id":"sub_1","status":"active","customer_id":"ctm_1","custom_data":{"userId":"%s"},"current_billing_period":{"ends_at":"2026-10-17T12:00:00Z"}}}' "$UID")
TS=$(date +%s); H1=$(printf '%s:%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac whsec_test | awk '{print $2}')
curl -s -w " [%{http_code}]" -X POST -H "Paddle-Signature: ts=$TS;h1=$H1" --data "$BODY" $U/api/billing/paddle   # → {"ok":true} [200]
curl -s -w " [%{http_code}]" -X POST -H "Paddle-Signature: ts=$TS;h1=$H1" --data "$BODY" $U/api/billing/paddle   # → duplicate [200]
curl -s -w " [%{http_code}]" -X POST -H "Paddle-Signature: ts=$TS;h1=bad" --data "$BODY" $U/api/billing/paddle    # → [401]
curl -s -H "Authorization: Bearer <csync token>" $U/api/companion/me                                            # → "plan":"pro"
```

Then `delete from plans where user_id=…; delete from billing_events;` to reset, and remove the temporary env values.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(billing): Paddle webhook with signature verification, event mapping and customer portal"
```

---

## Task 5: Pricing page, Plan card, Pro badge, limit toasts

**Files:**

- Create: `lib/billing/public.ts`, `app/(marketing)/layout.tsx`, `app/(marketing)/pricing/page.tsx`, `components/billing/pricing-table.tsx`, `components/billing/upgrade-buttons.tsx`, `components/settings-page/plan-card.tsx`
- Modify: `components/ui/toaster.tsx` (add `toastError`), `components/games/game-dialog.tsx:103`, `components/games/catalog-picker.tsx:26`, `components/import-export/import-form.tsx:73`, `components/import-export/game-files-form.tsx` (import error), `app/(app)/settings/page.tsx`, `app/(app)/layout.tsx`, `components/app/shell.tsx`, `proxy.ts` (nothing: `/pricing` is public and not in PROTECTED)

**Interfaces:**

- Consumes: `getPlan`, `getPlanAction`, `portalSessionAction`, `billingEnabled`, `env.PADDLE_PRICE_MONTHLY/LIFETIME`.
- Produces: `PADDLE_PUBLIC = { token: string | undefined; environment: "sandbox" | "production" }`; `PRICES = { monthly: "2.99 €/month", lifetime: "24.99 € once" }`; `toastError(message: string)`.

- [ ] **Step 1: `lib/billing/public.ts`** (no server-only; `NEXT_PUBLIC_*` is inlined at build):

```ts
/** Client-safe billing constants. Price ids come from the server as props; these are display-only. */
export const PADDLE_PUBLIC = {
  token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  environment: process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production",
} as const;

export const PRICES = { monthly: "2.99 €/month", lifetime: "24.99 € once" } as const;

export const FEATURES = {
  free: [
    "Web app and the csync companion",
    "Up to 3 active games",
    "Manual apply with automatic local backups",
    "10 snapshots per preset",
    "Public profile with your configs (coming soon)",
  ],
  pro: [
    "Unlimited games and presets",
    "Unlimited snapshot history",
    "Auto-switch: the companion applies presets when a game starts (coming soon)",
    "AI screenshot importer (coming soon)",
    "Cloud sync across your PCs (coming soon)",
  ],
} as const;
```

- [ ] **Step 2: `components/ui/toaster.tsx`** — add:

```ts
import { toast } from "sonner";

/** Error toast; limit errors get a "See plans" action so the way out is one click. */
export function toastError(message: string) {
  if (message.includes("upgrade to Pro"))
    toast.error(message, {
      duration: 6000,
      action: { label: "See plans", onClick: () => window.location.assign("/pricing") },
    });
  else toast.error(message);
}
```

Replace the four call sites with `toastError(result.error)` (import form keeps its `.split("\n")[0]`). `game-files-form.tsx`: the `importGameConfigAction` failure branch.

- [ ] **Step 3: `components/billing/upgrade-buttons.tsx`**:

```tsx
"use client";
import * as React from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPlanAction } from "@/lib/actions/billing";
import { PADDLE_PUBLIC, PRICES } from "@/lib/billing/public";

type PaddleJs = {
  Environment: { set: (env: "sandbox" | "production") => void };
  Initialize: (o: { token: string; eventCallback?: (e: { name: string }) => void }) => void;
  Checkout: {
    open: (o: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
    }) => void;
  };
};
declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

type Props = { email: string; userId: string; prices: { monthly: string; lifetime: string } };

/** Two Paddle overlay checkouts. After `checkout.completed`, polls the plan until the webhook lands. */
export function UpgradeButtons({ email, userId, prices }: Props) {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  const [waiting, setWaiting] = React.useState(false);

  const init = React.useCallback(() => {
    const P = window.Paddle;
    if (!P || !PADDLE_PUBLIC.token) return;
    if (PADDLE_PUBLIC.environment === "sandbox") P.Environment.set("sandbox");
    P.Initialize({
      token: PADDLE_PUBLIC.token,
      eventCallback: (e) => {
        if (e.name !== "checkout.completed") return;
        setWaiting(true);
        const started = Date.now();
        const poll = async () => {
          const r = await getPlanAction();
          if (r.ok && r.data.plan === "pro") {
            toast.success("You're on Pro. Thank you!");
            setWaiting(false);
            router.refresh();
            return;
          }
          if (Date.now() - started < 30_000) setTimeout(poll, 2000);
          else {
            setWaiting(false);
            toast(
              "Payment received — Pro activates as soon as Paddle confirms it (a minute at most).",
            );
          }
        };
        void poll();
      },
    });
    setReady(true);
  }, [router]);

  React.useEffect(() => {
    if (window.Paddle) init(); // script already loaded (navigated back to this page)
  }, [init]);

  const open = (priceId: string) =>
    window.Paddle?.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email },
      customData: { userId },
    });

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={init}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="primary"
          disabled={!ready || waiting}
          loading={waiting}
          onClick={() => open(prices.monthly)}
        >
          Go Pro — {PRICES.monthly}
        </Button>
        <Button
          variant="secondary"
          disabled={!ready || waiting}
          onClick={() => open(prices.lifetime)}
        >
          Lifetime — {PRICES.lifetime}
        </Button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: `components/billing/pricing-table.tsx`**:

```tsx
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURES, PRICES } from "@/lib/billing/public";
import { UpgradeButtons } from "./upgrade-buttons";

type Props = {
  viewer: { email: string; userId: string; plan: "free" | "pro" } | null;
  prices: { monthly: string; lifetime: string } | null; // null when billing is disabled
};

export function PricingTable({ viewer, prices }: Props) {
  const col = "flex flex-col gap-4 rounded-md border border-line bg-surface p-6";
  const list = (items: readonly string[]) => (
    <ul className="flex flex-col gap-2 text-[13px] text-ink-2">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
          <span className={f.endsWith("(coming soon)") ? "text-ink-3" : undefined}>{f}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className={col} aria-labelledby="plan-free">
        <h2 id="plan-free" className="font-display text-xl">
          Free
        </h2>
        <p className="text-[13px] text-ink-2">Everything you need to keep your settings safe.</p>
        {list(FEATURES.free)}
        {!viewer ? (
          <Button asChild variant="secondary">
            <Link href="/sign-up">Create a free account</Link>
          </Button>
        ) : null}
      </section>
      <section className={`${col} border-accent`} aria-labelledby="plan-pro">
        <h2 id="plan-pro" className="font-display text-xl">
          Pro
        </h2>
        <p className="text-[13px] text-ink-2">
          {PRICES.monthly} · or {PRICES.lifetime}
        </p>
        {list(FEATURES.pro)}
        {!prices ? (
          <p className="text-[13px] text-ink-3">
            This instance has billing turned off — every account is Pro.
          </p>
        ) : !viewer ? (
          <Button asChild variant="primary">
            <Link href="/sign-up?next=/pricing">Sign up, then go Pro</Link>
          </Button>
        ) : viewer.plan === "pro" ? (
          <p className="text-[13px] text-ink">
            You're on Pro. Manage it in{" "}
            <Link href="/settings#plan" className="underline underline-offset-4">
              Settings
            </Link>
            .
          </p>
        ) : (
          <UpgradeButtons email={viewer.email} userId={viewer.userId} prices={prices} />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Marketing layout + page** — `app/(marketing)/layout.tsx` mirrors `app/(auth)/layout.tsx` but with a wider `main` (`max-w-3xl`) and a header link to `/dashboard` when signed in is unnecessary — keep it identical except `max-w-3xl`. `app/(marketing)/pricing/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getPlan } from "@/lib/billing/plan";
import { billingEnabled, env } from "@/lib/env";
import { PricingTable } from "@/components/billing/pricing-table";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const session = await getSession();
  const viewer = session
    ? {
        email: session.user.email,
        userId: session.user.id,
        plan: (await getPlan(session.user.id)).plan,
      }
    : null;
  const prices =
    billingEnabled && env.PADDLE_PRICE_MONTHLY && env.PADDLE_PRICE_LIFETIME
      ? { monthly: env.PADDLE_PRICE_MONTHLY, lifetime: env.PADDLE_PRICE_LIFETIME }
      : null;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl">Plans</h1>
        <p className="mt-2 text-[13px] text-ink-2">
          Free is free forever. Pro pays for the servers and the AI.
        </p>
      </div>
      <PricingTable viewer={viewer} prices={prices} />
    </div>
  );
}
```

Check `getSession()`'s return shape in `lib/auth/session.ts` (`session.user.id/email`).

- [ ] **Step 6: Plan card** — `components/settings-page/plan-card.tsx`:

```tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { portalSessionAction } from "@/lib/actions/billing";
import type { PlanInfo } from "@/lib/billing/plan";
import { UpgradeButtons } from "@/components/billing/upgrade-buttons";

type Props = {
  info: PlanInfo;
  email: string;
  userId: string;
  prices: { monthly: string; lifetime: string } | null;
};

export function PlanCard({ info, email, userId, prices }: Props) {
  const [pending, start] = React.useTransition();
  const manage = () =>
    start(async () => {
      const r = await portalSessionAction();
      if (!r.ok) return void toast.error(r.error);
      window.location.assign(r.data.url);
    });
  const until = info.currentPeriodEnd?.toLocaleDateString();
  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <p className="flex items-center gap-2 text-ink">
        <Badge variant={info.plan === "pro" ? "accent" : "outline"}>
          {info.plan === "pro" ? "Pro" : "Free"}
        </Badge>
        {info.source === "lifetime" ? "Lifetime — thank you." : null}
        {info.source === "subscription" && info.subscriptionStatus === "canceled" && until
          ? `Pro until ${until}.`
          : null}
        {info.source === "subscription" && info.subscriptionStatus === "active" && until
          ? `Renews ${until}.`
          : null}
        {info.source === "subscription" && info.subscriptionStatus === "past_due"
          ? "Payment failed — update your card in the portal."
          : null}
      </p>
      {info.plan === "free" && prices ? (
        <UpgradeButtons email={email} userId={userId} prices={prices} />
      ) : null}
      {info.source === "subscription" ? (
        <Button variant="secondary" onClick={manage} loading={pending} className="self-start">
          Manage subscription
        </Button>
      ) : null}
      <p className="text-ink-3">
        Compare plans on the{" "}
        <Link href="/pricing" className="underline underline-offset-4 hover:text-ink">
          pricing page
        </Link>
        .
      </p>
    </div>
  );
}
```

`app/(app)/settings/page.tsx`: import `billingEnabled, env` from `@/lib/env` and `getPlan` from `@/lib/billing/plan`; compute

```ts
const prices =
  env.PADDLE_PRICE_MONTHLY && env.PADDLE_PRICE_LIFETIME
    ? { monthly: env.PADDLE_PRICE_MONTHLY, lifetime: env.PADDLE_PRICE_LIFETIME }
    : null;
```

and, when `billingEnabled`, render as the first section:

```tsx
<Section id="plan" title="Plan">
  <PlanCard info={await getPlan(user.id)} email={user.email} userId={user.id} prices={prices} />
</Section>
```

- [ ] **Step 7: Pro badge** — `app/(app)/layout.tsx`: `const { plan } = await getPlan(user.id);` and pass `plan={billingEnabled ? plan : null}` to `AppShell`. `components/app/shell.tsx`: prop `plan?: "free" | "pro" | null`; in the header before `<UserMenu>`: `{plan === "pro" ? <Badge variant="accent">Pro</Badge> : null}` (import `Badge`).

- [ ] **Step 8: Verify** — `pnpm check` PASS; `pnpm exec prettier --check .` PASS. Billing off: `/pricing` shows "billing turned off"; Settings has no Plan section; no badge. Billing on with dummy env (`PADDLE_API_KEY=x PADDLE_WEBHOOK_SECRET=x PADDLE_PRICE_MONTHLY=pri_m PADDLE_PRICE_LIFETIME=pri_l NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_x NEXT_PUBLIC_PADDLE_ENV=sandbox`): `/pricing` signed out → sign-up button; signed in Free → two upgrade buttons (enabled once paddle.js loads); Settings → Plan shows Free + buttons; after the manual webhook from Task 4 Step 6 → badge "Pro", card shows "Renews …", "Manage subscription" (fails with a sentence since the API key is fake — expected).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(billing): pricing page, plan card, Pro badge, upgrade checkout and limit toasts"
```

---

## Task 6: Docs, env, CI/e2e

**Files:**

- Create: `docs/billing.md`
- Modify: `.env.example`, `docs/self-hosting.md` (env table), `README.md` (features + docs list), `docs/architecture/overview.md` (data model + billing paragraph), `.github/workflows/ci.yml` (env), `playwright.config.ts` (webServer env), `e2e/vault.spec.ts`

- [ ] **Step 1: `docs/billing.md`**:

````markdown
# Billing (Paddle)

ConfigSync sells Pro through [Paddle Billing](https://www.paddle.com/billing) as merchant of
record: Paddle is the seller, handles VAT and invoices, and tells the server who paid via
webhooks. Leave every `PADDLE_*` variable unset to run without billing — every account is Pro.

## One-time setup (owner)

1. Paddle → Catalog: one product "ConfigSync Pro" with two prices — **Monthly** (recurring,
   1 month) and **Lifetime** (one-time). Copy both price ids (`pri_…`).
2. Paddle → Developer tools → Authentication: create an **API key** and a **client-side token**.
3. Paddle → Developer tools → Notifications: add a destination `https://<your-domain>/api/billing/paddle`,
   type webhook, events: `transaction.completed`, `subscription.activated`, `subscription.updated`,
   `subscription.canceled`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`.
   Copy the **secret key** (`pdl_ntfset_…`).
4. Set the environment:

| Variable                          | Value                                         |
| --------------------------------- | --------------------------------------------- |
| `PADDLE_API_KEY`                  | API key                                       |
| `PADDLE_WEBHOOK_SECRET`           | notification destination secret               |
| `PADDLE_PRICE_MONTHLY`            | `pri_…` of the monthly price                  |
| `PADDLE_PRICE_LIFETIME`           | `pri_…` of the lifetime price                 |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | client-side token                             |
| `NEXT_PUBLIC_PADDLE_ENV`          | `sandbox` while testing, `production` to sell |

Sandbox and live are separate Paddle accounts with separate keys and price ids.

## How a purchase becomes Pro

Checkout runs in Paddle's overlay with `customData.userId`. Paddle posts events to
`/api/billing/paddle`; the server verifies the `Paddle-Signature` HMAC, stores the event id
(retries are no-ops), maps the event to a `plans` row and answers 200. `getPlan()` reads that
row: lifetime ⇒ Pro forever; subscription `active`/`trialing`/`past_due` ⇒ Pro; `canceled` ⇒
Pro until the paid period ends. Nothing is deleted on downgrade.

## Granting Pro by hand

```sql
insert into plans (user_id, source) values ('<user id>', 'manual')
on conflict (user_id) do update set source = 'manual';
```
````

## Testing locally

Use the sandbox account. Paddle's dashboard can send simulated events to your webhook — or
sign one yourself: `printf '%s:%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET"` and
send it as `Paddle-Signature: ts=$TS;h1=<hex>`.

````

- [ ] **Step 2: Env + docs** — `.env.example`: add a `# --- Optional: Paddle billing ---` block with the six variables empty and one line "Leave unset to run without plans (everyone is Pro)." `docs/self-hosting.md` env table: one row per variable, "no", pointing to `docs/billing.md`. `README.md`: feature bullet "**Free and Pro.** Free keeps 3 games and 10 snapshots per preset; Pro is 2.99 €/month or 24.99 € once. Self-hosting has no plans." and docs list entry `[Billing](docs/billing.md)`. `docs/architecture/overview.md`: data model gains `├─ plans (Paddle ids, status, period end — read by getPlan)` and `billing_events`; a short "## Plans" paragraph: gates in `createGame`/`createRevision`, webhook is the only writer, `billingEnabled` switch.

- [ ] **Step 3: CI + Playwright env** — `.github/workflows/ci.yml` `env:` add:

```yaml
  PADDLE_API_KEY: ci-dummy
  PADDLE_WEBHOOK_SECRET: ci-dummy
  PADDLE_PRICE_MONTHLY: pri_ci_monthly
  PADDLE_PRICE_LIFETIME: pri_ci_lifetime
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: test_ci
  NEXT_PUBLIC_PADDLE_ENV: sandbox
````

`playwright.config.ts` `webServer.env`: the same six keys, so local `pnpm test:e2e` runs with limits on.

- [ ] **Step 4: E2E** — in `e2e/vault.spec.ts`, right after the "Catalog entry already owned shows disabled" block (the account then has exactly 3 active games: Test Arena, Imported Arena, Counter-Strike 2):

```ts
// --- Free limit: a 4th active game is refused with a way out ------------
await page.goto("/games");
await page.getByRole("button", { name: "Add game" }).first().click();
const fourth = page.getByRole("dialog", { name: "Add a game" });
await fourth.getByLabel("Name").fill("Fourth Game");
await fourth.getByRole("button", { name: "Add game" }).click();
await expect(page.getByText("Free keeps up to 3 active games")).toBeVisible();
await expect(page.getByRole("button", { name: "See plans" })).toBeVisible();
await page.keyboard.press("Escape");
await expect(page.getByText("Fourth Game")).toHaveCount(0);
```

Also assert the pricing page renders: `await page.goto("/pricing"); await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();`.

- [ ] **Step 5: Verify** — `pnpm check`, `pnpm exec prettier --check .`, `node --test "companion/test/**/*.test.mjs"`, `pnpm test:e2e` (stop any `next dev` first) all PASS.

- [ ] **Step 6: Commit and push**

```bash
git add -A && git commit -m "docs: billing setup guide; CI and e2e run with plans enabled"
git push -u origin feat/configsync-foundation
```

Open a PR against `feat/catalog-companion` (stacked) or, if PR #1 has merged by then, rebase onto `main` and target `main`.

---

## Self-review notes

- Spec A (rebrand) → Task 1; B (license) → Task 2; C (plans, limits, `/me`) → Task 3; D (Paddle checkout, webhook, portal) → Tasks 4–5; E (UI) → Task 5; docs/testing → Task 6.
- Names used across tasks: `Plan`, `PlanRow`, `PlanSource`, `resolvePlan`, `limitsFor`, `LIMITS`, `GAME_LIMIT_MESSAGE` (3, 5, 6); `getPlan`, `PlanInfo`, `assertCanAddGame` (3, 4, 5); `verifyPaddleSignature`, `paddleEventSchema`, `applyPaddleEvent` (4); `getPlanRow`, `upsertPlanRow`, `recordBillingEvent`, `findUserIdByCustomer`, `userExists` (3, 4); `createPortalSession` (4, 5); `getPlanAction`, `portalSessionAction` (4, 5); `toastError` (5); `PADDLE_PUBLIC`, `PRICES`, `FEATURES` (5).
- `past_due` resolves to Pro without a date check (spec said "while period end > now"); the plan's rule is simpler and errs toward the paying customer — Paddle's dunning ends in `subscription.canceled`, which does carry the cutoff. The spec is updated to match.
- Deliberate simplifications: `listRevisions` display cap 200 (was tied to the old constant); un-archive over-counts an already-active game (UI never offers that).
