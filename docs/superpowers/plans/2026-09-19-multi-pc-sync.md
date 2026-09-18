# Multi-PC Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Pro user pick, per PC and per catalog game, which preset that PC runs, and show what each PC last applied — without changing the daemon's decision logic.

**Architecture:** Two new tables (`devices`, `device_presets`). Every companion call that carries a device name upserts the device (heartbeat); `csync watch` switches from `GET /sync` to `POST /sync` with its state, and the server resolves each game's target as override-or-Default. A game-page card edits overrides and renders per-device status computed by a pure `deviceStatus()`.

**Tech Stack:** Next.js 16 (route handlers + server actions), Drizzle + Postgres, zod 4, the Node ESM companion CLI (`companion/`), vitest + `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-19-multi-pc-sync-design.md`

## Global Constraints

- Branch `feat/multi-pc-sync` is stacked on `feat/ai-screenshot-importer` (PR #5) so the migration is `0005_devices`. Open the PR against `feat/ai-screenshot-importer`; when #5 merges, retarget to `main`. **Never merge #5 with `--delete-branch` while this PR is open** (GitHub closes the stacked PR) — retarget first.
- `/sync` `GET` keeps working exactly as today (no device, Default only). Only `POST` carries identity and state.
- `decide()` in `companion/lib/sync.mjs` is not touched.
- Device identity is the CLI's `device` name (hostname by default), unique per user; ids never come from the client.
- Pro gating: `/sync` (both verbs) and `setDevicePresetAction` require `getPlan(userId).plan === "pro"`; the game-page card renders only for Pro. Free sees nothing new.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- After each task: `pnpm typecheck`. Before the PR: `pnpm check`, `node --test "companion/test/**/*.test.mjs"`, `pnpm format:check`, `pnpm build`.
- Next.js 16: read `node_modules/next/dist/docs/` if a route-handler or server-action API looks unfamiliar.

---

## File map

| File                                                                                         | Responsibility                                                                                             |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `lib/db/schema.ts` + `drizzle/0005_devices.sql`                                              | `devices`, `device_presets`, `DeviceApplied` type, backfill                                                |
| `lib/companion/device-status.ts` (create)                                                    | `deviceStatus()` — pure, tested                                                                            |
| `lib/data/devices.ts` (modify)                                                               | `touchDevice`, `listDevices`, `forgetDevice`, `listDevicesForGame`, `setDevicePreset`, `deviceRowsForGame` |
| `lib/data/catalog.ts` (modify)                                                               | `defaultPresetFor(…, device?)`, `overrideFor`, `listSyncTargets(…, device?)`, `SyncTarget.source`          |
| `app/api/companion/sync/route.ts`, `default/route.ts`, `devices/route.ts`, `import/route.ts` | Heartbeat + device-aware resolution                                                                        |
| `lib/actions/companion.ts` (modify)                                                          | `setDevicePresetAction`, `forgetDeviceAction`                                                              |
| `companion/lib/state.mjs`, `companion/bin/csync.mjs`, `companion/test/state.test.mjs`        | `reportable()`, POST `/sync`, `launch` device param                                                        |
| `components/games/device-presets-card.tsx` (create), `app/(app)/games/[gameSlug]/page.tsx`   | "On your PCs" card                                                                                         |
| `components/settings-page/companion-card.tsx`, `app/(app)/settings/page.tsx`                 | Devices list from `devices` + Forget                                                                       |
| `lib/billing/public.ts`, `docs/companion.md`                                                 | Copy and docs                                                                                              |
| `tests/device-status.test.ts`                                                                | Unit test                                                                                                  |

---

### Task 0: Branch

- [ ] **Step 1: Confirm the branch and its base**

```bash
cd /home/miguelferreira/Desktop/Settings_Saver
git checkout feat/multi-pc-sync
git log --oneline -3   # expect: spec commit, then "docs: AI screenshot importer" (tip of PR #5)
ls drizzle/*.sql | tail -1   # expect drizzle/0004_ai_requests.sql
```

---

### Task 1: Tables and migration

**Files:**

- Modify: `lib/db/schema.ts` (after the `deviceGames` table, before `aiRequests`)
- Create: `drizzle/0005_devices.sql` (generated + one appended statement)

**Interfaces:**

- Produces: `schema.devices`, `schema.devicePresets`, `type DeviceApplied`, `type Device` from `@/lib/db/schema`.

- [ ] **Step 1: Add the tables and the column type**

Insert after the `deviceGames` table definition:

```ts
/** Mirror of the daemon's state.json, keyed by catalog id. `status` comes from the daemon's current run. */
export type DeviceApplied = Record<
  string,
  { presetSlug: string; version: string; at: string; status: "applied" | "waiting" | "failed" }
>;

/** One row per machine that has talked to the vault (hostname by default). */
export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** process.platform of the CLI: linux | win32 | darwin. */
    platform: text("platform"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    applied: jsonb("applied").$type<DeviceApplied>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("devices_user_name_uq").on(t.userId, t.name)],
);

/** Per-PC choice of preset for a game. No row ⇒ the game's Default. */
export const devicePresets = pgTable(
  "device_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    presetId: uuid("preset_id")
      .notNull()
      .references(() => presets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("device_presets_device_game_uq").on(t.deviceId, t.gameId)],
);
```

`games` and `presets` are declared above `deviceGames` in the file, so the references resolve. Next to the other `$inferSelect` exports at the bottom add `export type Device = typeof devices.$inferSelect;`.

- [ ] **Step 2: Generate the migration and append the backfill**

```bash
pnpm db:generate --name devices
cat drizzle/0005_devices.sql
```

Expected: `CREATE TABLE "devices"`, `CREATE TABLE "device_presets"`, their FKs and the two unique indexes — nothing else. Then append (the file ends with the last `CREATE UNIQUE INDEX …;`):

```bash
cat >> drizzle/0005_devices.sql <<'EOF'
--> statement-breakpoint
INSERT INTO "devices" ("user_id", "name", "last_seen_at")
SELECT "user_id", "device", max("seen_at") FROM "device_games" GROUP BY 1, 2
ON CONFLICT DO NOTHING;
EOF
pnpm db:migrate
docker exec settings_saver-db-1 psql -U gsv gsv -Atc "select name, last_seen_at from devices;"
```

Expected: migration applied; one row per device that had scanned before (this machine's hostname at least, if `csync scan --push` ever ran here; an empty result is fine otherwise).

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm typecheck
git add lib/db/schema.ts drizzle
git commit -m "feat(db): devices and device_presets tables

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `deviceStatus()`

**Files:**

- Create: `lib/companion/device-status.ts`
- Test: `tests/device-status.test.ts`

**Interfaces:**

- Consumes: `DeviceApplied` (Task 1).
- Produces: `type DeviceStatus`, `deviceStatus(applied, want)`.

- [ ] **Step 1: Failing test**

`tests/device-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deviceStatus } from "@/lib/companion/device-status";

const at = "2026-09-19T10:00:00.000Z";
const applied = { presetSlug: "main", version: "aaaa", at, status: "applied" as const };
const want = { presetSlug: "main", version: "aaaa" };

describe("deviceStatus", () => {
  it("never synced when the daemon reported nothing for the game", () => {
    expect(deviceStatus(undefined, want)).toEqual({ kind: "never" });
  });
  it("applied when the last write matches what the server wants now", () => {
    expect(deviceStatus(applied, want)).toEqual({ kind: "applied", presetSlug: "main", at });
    expect(deviceStatus(applied, null)).toEqual({ kind: "applied", presetSlug: "main", at });
  });
  it("stale when the server wants a different preset or version", () => {
    expect(deviceStatus(applied, { presetSlug: "main", version: "bbbb" })).toEqual({
      kind: "stale",
      presetSlug: "main",
      at,
    });
    expect(deviceStatus(applied, { presetSlug: "laptop", version: "aaaa" }).kind).toBe("stale");
  });
  it("waiting and failed come straight from the daemon's report", () => {
    expect(deviceStatus({ ...applied, status: "waiting" }, want)).toEqual({
      kind: "waiting",
      presetSlug: "main",
    });
    expect(deviceStatus({ presetSlug: "", version: "", at: "", status: "waiting" }, want)).toEqual({
      kind: "waiting",
      presetSlug: "",
    });
    expect(deviceStatus({ ...applied, status: "failed" }, want)).toEqual({
      kind: "failed",
      presetSlug: "main",
      at,
    });
  });
});
```

- [ ] **Step 2: Run it (fails on the missing module)**

Run: `pnpm vitest run tests/device-status.test.ts`

- [ ] **Step 3: Implement**

`lib/companion/device-status.ts`:

```ts
import type { DeviceApplied } from "@/lib/db/schema";

export type DeviceStatus =
  | { kind: "never" }
  | { kind: "applied"; presetSlug: string; at: string }
  | { kind: "waiting"; presetSlug: string }
  | { kind: "failed"; presetSlug: string; at: string }
  /** The daemon's last write is not what the server wants now; it applies on its next idle tick. */
  | { kind: "stale"; presetSlug: string; at: string };

/** Combines what a device last reported with what the server wants it to have. */
export function deviceStatus(
  applied: DeviceApplied[string] | undefined,
  want: { presetSlug: string; version: string } | null,
): DeviceStatus {
  if (!applied) return { kind: "never" };
  if (applied.status === "failed")
    return { kind: "failed", presetSlug: applied.presetSlug, at: applied.at };
  if (applied.status === "waiting") return { kind: "waiting", presetSlug: applied.presetSlug };
  if (want && (want.presetSlug !== applied.presetSlug || want.version !== applied.version))
    return { kind: "stale", presetSlug: applied.presetSlug, at: applied.at };
  return { kind: "applied", presetSlug: applied.presetSlug, at: applied.at };
}
```

- [ ] **Step 4: Run, then commit**

Run: `pnpm vitest run tests/device-status.test.ts` → 4 passed.

```bash
git add lib/companion/device-status.ts tests/device-status.test.ts
git commit -m "feat(companion): deviceStatus() for per-PC sync state

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Data layer

**Files:**

- Modify: `lib/data/devices.ts` (whole file)
- Modify: `lib/data/catalog.ts:113-160` (`SyncTarget`, `defaultPresetFor`, `listSyncTargets`)

**Interfaces:**

- Consumes: Task 1 tables; `getPresetById` from `./presets`; `deviceStatus` (Task 2).
- Produces (from `@/lib/data/devices`): `touchDevice(userId, name, opts?)`, `listDevices(userId)` → `{ id, name, platform, lastSeenAt, games }[]`, `forgetDevice(userId, deviceId)`, `listDevicesForGame(userId, gameId)`, `setDevicePreset(userId, deviceId, gameId, presetId | null)`, `deviceRowsForGame(userId, game: { id, catalogId })` → `DeviceRow[]`, `type DeviceRow`.
- Produces (from `@/lib/data/catalog`): `SyncTarget` gains `source: "device" | "default"`; `defaultPresetFor(userId, catalogId, device?: string | null)`; `listSyncTargets(userId, device?: string | null)`.

- [ ] **Step 1: Rewrite `lib/data/devices.ts`**

```ts
import "server-only";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { DeviceApplied } from "@/lib/db/schema";
import { deviceStatus, type DeviceStatus } from "@/lib/companion/device-status";
import { defaultPresetFor } from "./catalog";
import { AppError, notFound } from "./errors";
import { getPresetById } from "./presets";

const { deviceGames, devices, devicePresets } = schema;
export type DeviceGameInput = {
  source: "steam" | "epic";
  appId: string;
  name: string;
  installDir?: string | null;
};

/** Heartbeat: upsert by (user, name). Only the fields passed are changed. */
export async function touchDevice(
  userId: string,
  name: string,
  opts: { platform?: string | null; applied?: DeviceApplied } = {},
) {
  const [row] = await db
    .insert(devices)
    .values({ userId, name, platform: opts.platform ?? null, applied: opts.applied ?? {} })
    .onConflictDoUpdate({
      target: [devices.userId, devices.name],
      set: {
        lastSeenAt: new Date(),
        ...(opts.platform !== undefined ? { platform: opts.platform } : {}),
        ...(opts.applied !== undefined ? { applied: opts.applied } : {}),
      },
    })
    .returning();
  return row!;
}

/** A scan is the whole truth for that device: replace its rows. */
export async function replaceDeviceGames(userId: string, device: string, games: DeviceGameInput[]) {
  return db.transaction(async (tx) => {
    await tx
      .delete(deviceGames)
      .where(and(eq(deviceGames.userId, userId), eq(deviceGames.device, device)));
    if (games.length === 0) return 0;
    await tx
      .insert(deviceGames)
      .values(games.map((g) => ({ ...g, userId, device, installDir: g.installDir ?? null })));
    return games.length;
  });
}

export async function listDeviceGames(userId: string, q?: string) {
  const where = q?.trim()
    ? and(
        eq(deviceGames.userId, userId),
        ilike(deviceGames.name, `%${q.trim().replace(/[%_\\]/g, "\\$&")}%`),
      )
    : eq(deviceGames.userId, userId);
  return db.select().from(deviceGames).where(where).orderBy(deviceGames.name).limit(20);
}

/** Devices for Settings: newest heartbeat first, with how many games their last scan found. */
export async function listDevices(userId: string) {
  const rows = await db
    .select({
      id: devices.id,
      name: devices.name,
      platform: devices.platform,
      lastSeenAt: devices.lastSeenAt,
      games: sql<number>`(select count(*) from device_games dg where dg.user_id = ${devices.userId} and dg.device = ${devices.name})`,
    })
    .from(devices)
    .where(eq(devices.userId, userId))
    .orderBy(desc(devices.lastSeenAt));
  return rows.map((r) => ({ ...r, games: Number(r.games) }));
}

/** Removes the device, its per-PC choices (cascade) and its scanned games. */
export async function forgetDevice(userId: string, deviceId: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(devices)
      .where(and(eq(devices.userId, userId), eq(devices.id, deviceId)))
      .returning({ name: devices.name });
    if (!row) throw notFound("device");
    await tx
      .delete(deviceGames)
      .where(and(eq(deviceGames.userId, userId), eq(deviceGames.device, row.name)));
  });
}

export async function listDevicesForGame(userId: string, gameId: string) {
  return db
    .select({
      id: devices.id,
      name: devices.name,
      platform: devices.platform,
      lastSeenAt: devices.lastSeenAt,
      applied: devices.applied,
      presetId: devicePresets.presetId,
    })
    .from(devices)
    .leftJoin(
      devicePresets,
      and(eq(devicePresets.deviceId, devices.id), eq(devicePresets.gameId, gameId)),
    )
    .where(eq(devices.userId, userId))
    .orderBy(desc(devices.lastSeenAt));
}

/** null clears the override (back to Default). The preset must be the user's and belong to the game. */
export async function setDevicePreset(
  userId: string,
  deviceId: string,
  gameId: string,
  presetId: string | null,
) {
  const device = await db.query.devices.findFirst({
    where: and(eq(devices.userId, userId), eq(devices.id, deviceId)),
  });
  if (!device) throw notFound("device");
  if (presetId === null) {
    await db
      .delete(devicePresets)
      .where(and(eq(devicePresets.deviceId, deviceId), eq(devicePresets.gameId, gameId)));
    return;
  }
  const preset = await getPresetById(userId, presetId);
  if (preset.gameId !== gameId) throw new AppError("That preset belongs to another game.");
  await db
    .insert(devicePresets)
    .values({ userId, deviceId, gameId, presetId })
    .onConflictDoUpdate({
      target: [devicePresets.deviceId, devicePresets.gameId],
      set: { presetId },
    });
}

export type DeviceRow = {
  id: string;
  name: string;
  platform: string | null;
  lastSeenAt: Date;
  presetId: string | null;
  status: DeviceStatus;
};

/** Rows for the game page card: each device with its choice and what it last applied vs. what it should have. */
export async function deviceRowsForGame(
  userId: string,
  game: { id: string; catalogId: string },
): Promise<DeviceRow[]> {
  const rows = await listDevicesForGame(userId, game.id);
  // ponytail: one preset fingerprint per device per page view; fine for a handful of PCs.
  return Promise.all(
    rows.map(async (d) => {
      const want = await defaultPresetFor(userId, game.catalogId, d.name);
      return {
        id: d.id,
        name: d.name,
        platform: d.platform,
        lastSeenAt: d.lastSeenAt,
        presetId: d.presetId,
        status: deviceStatus(d.applied[game.catalogId], want),
      };
    }),
  );
}
```

- [ ] **Step 2: Device-aware resolution in `lib/data/catalog.ts`**

Replace `SyncTarget`, `defaultPresetFor` and `listSyncTargets` with:

```ts
export type SyncTarget = {
  catalogId: string;
  gameSlug: string;
  presetSlug: string;
  presetName: string;
  version: string;
  /** "device" when a per-PC choice applied, else the game's Default. */
  source: "device" | "default";
};

/** The preset a device chose for this game, unless it has been archived meanwhile. */
async function overrideFor(userId: string, device: string, gameId: string) {
  const [row] = await db
    .select({ id: schema.presets.id, slug: schema.presets.slug, name: schema.presets.name })
    .from(schema.devicePresets)
    .innerJoin(schema.devices, eq(schema.devices.id, schema.devicePresets.deviceId))
    .innerJoin(schema.presets, eq(schema.presets.id, schema.devicePresets.presetId))
    .where(
      and(
        eq(schema.devices.userId, userId),
        eq(schema.devices.name, device),
        eq(schema.devicePresets.gameId, gameId),
        eq(schema.presets.isArchived, false),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** What one catalog game should have on `device` (its choice, else the Default), with a content fingerprint. */
export async function defaultPresetFor(
  userId: string,
  catalogId: string,
  device?: string | null,
): Promise<SyncTarget | null> {
  const game = await findGameByCatalogId(userId, catalogId);
  if (!game) return null;
  const override = device ? await overrideFor(userId, device, game.id) : null;
  const row =
    override ??
    (await db.query.presets.findFirst({
      where: and(
        eq(schema.presets.gameId, game.id),
        eq(schema.presets.isDefault, true),
        eq(schema.presets.isArchived, false),
      ),
      columns: { id: true, slug: true, name: true },
    }));
  if (!row) return null;
  const full = await getPresetFull(userId, row.id);
  return {
    catalogId,
    gameSlug: game.slug,
    presetSlug: row.slug,
    presetName: row.name,
    version: presetFingerprint(toPresetDoc(full)),
    source: override ? "device" : "default",
  };
}

/** Every catalog game the user owns that has a target on this device. */
export async function listSyncTargets(
  userId: string,
  device?: string | null,
): Promise<SyncTarget[]> {
  const ids = await listOwnedCatalogIds(userId);
  // ponytail: one full-preset load per catalog game per poll; cache by max(updated_at) if it ever matters.
  const targets = await Promise.all(ids.map((id) => defaultPresetFor(userId, id, device)));
  return targets.filter((t): t is SyncTarget => t !== null);
}
```

`catalog.ts` does not import `devices.ts` (it reaches the tables through `schema`), so `devices.ts → catalog.ts` is not a cycle.

- [ ] **Step 3: Fix the Settings page's expectations and typecheck**

`components/settings-page/companion-card.tsx` still types `Device = { device, games, seenAt }`; change it now so the build stays green (the UI itself is Task 6):

```ts
type Device = {
  id: string;
  name: string;
  platform: string | null;
  lastSeenAt: Date;
  games: number;
};
```

and in the list: `key={d.id}`, `{d.name} — {plural(d.games, "game")}, seen {timeAgo(d.lastSeenAt)}`.

Run: `pnpm typecheck && pnpm vitest run` → clean.

- [ ] **Step 4: Commit**

```bash
git add lib/data/devices.ts lib/data/catalog.ts components/settings-page/companion-card.tsx
git commit -m "feat(sync): device registry, per-PC preset overrides, device-aware targets

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Companion routes and actions

**Files:**

- Modify: `app/api/companion/sync/route.ts`, `app/api/companion/default/route.ts`, `app/api/companion/devices/route.ts`, `app/api/companion/import/route.ts`
- Modify: `lib/actions/companion.ts`

**Interfaces:**

- Consumes: Task 3 functions.
- Produces: `POST /api/companion/sync` `{ device, platform?, applied? }` → `{ games: SyncTarget[] }`; `GET /api/companion/default?game=&device=`; `setDevicePresetAction({ deviceId, gameId, presetId })`, `forgetDeviceAction(deviceId)`.

- [ ] **Step 1: `/sync`**

```ts
import { z } from "zod";
import { companionRoute } from "@/lib/api/companion";
import { getPlan } from "@/lib/billing/plan";
import { listSyncTargets } from "@/lib/data/catalog";
import { touchDevice } from "@/lib/data/devices";
import { AppError } from "@/lib/data/errors";
import { env } from "@/lib/env";

async function assertPro(userId: string) {
  if ((await getPlan(userId)).plan !== "pro")
    throw new AppError(
      `Auto-switch is a Pro feature. Upgrade at ${env.NEXT_PUBLIC_APP_URL}/pricing.`,
      "forbidden",
    );
}

/** Legacy poll without device identity: the Default preset of every owned catalog game. Pro only. */
export const GET = companionRoute(null, async (_i, userId) => {
  await assertPro(userId);
  return { games: await listSyncTargets(userId) };
});

const appliedSchema = z
  .record(
    z.string().max(60),
    z.object({
      presetSlug: z.string().max(120),
      version: z.string().max(64),
      at: z.string().max(40).default(""),
      status: z.enum(["applied", "waiting", "failed"]),
    }),
  )
  .refine((r) => Object.keys(r).length <= 200, "Too many games");
const body = z.object({
  device: z.string().trim().min(1).max(60),
  platform: z.string().max(20).optional(),
  applied: appliedSchema.optional(),
});

/** What `csync watch` polls: records the device and its state, answers with each game's preset for this PC. Pro only. */
export const POST = companionRoute(body, async (v, userId) => {
  await assertPro(userId);
  await touchDevice(userId, v.device, { platform: v.platform, applied: v.applied });
  return { games: await listSyncTargets(userId, v.device) };
});
```

- [ ] **Step 2: `/default`, `/devices`, `/import`**

`default/route.ts`:

```ts
import { companionRoute } from "@/lib/api/companion";
import { defaultPresetFor } from "@/lib/data/catalog";
import { touchDevice } from "@/lib/data/devices";
import { AppError } from "@/lib/data/errors";
import { catalogIdSchema } from "@/lib/validation";

/** The preset one catalog game should have on this PC — for `csync launch`. Free. */
export const GET = companionRoute(null, async (_i, userId, req) => {
  const params = new URL(req.url).searchParams;
  const game = catalogIdSchema.safeParse(params.get("game"));
  if (!game.success) throw new AppError("Pass ?game=<catalog id>.", "invalid");
  const device = params.get("device")?.trim().slice(0, 60) || null;
  if (device) await touchDevice(userId, device);
  const target = await defaultPresetFor(userId, game.data, device);
  if (!target)
    throw new AppError(`You don't have a Default preset for ${game.data} yet.`, "not_found");
  return target;
});
```

`devices/route.ts` handler body becomes:

```ts
export const PUT = companionRoute(body, async (v, userId) => {
  await touchDevice(userId, v.device);
  return { stored: await replaceDeviceGames(userId, v.device, v.games) };
});
```

`import/route.ts`: add `import { touchDevice } from "@/lib/data/devices";` and, as the first line of the handler, `if (v.device) await touchDevice(userId, v.device);`.

- [ ] **Step 3: Actions**

Append to `lib/actions/companion.ts` (add imports `getPlan` from `@/lib/billing/plan`, `AppError` from `@/lib/data/errors`, `forgetDevice, setDevicePreset` from `@/lib/data/devices`):

```ts
/** Which preset a PC runs for a game; null = back to the Default. Pro. */
export async function setDevicePresetAction(raw: unknown) {
  return runAction(
    z.object({ deviceId: id, gameId: id, presetId: id.nullable() }),
    raw,
    async (v, userId) => {
      if ((await getPlan(userId)).plan !== "pro")
        throw new AppError(
          "Per-PC presets are a Pro feature — upgrade to Pro to use them.",
          "forbidden",
        );
      await setDevicePreset(userId, v.deviceId, v.gameId, v.presetId);
      revalidatePath("/", "layout");
      return null;
    },
  );
}

export async function forgetDeviceAction(deviceId: string) {
  return runAction(z.object({ deviceId: id }), { deviceId }, async (v, userId) => {
    await forgetDevice(userId, v.deviceId);
    revalidatePath("/", "layout");
    return null;
  });
}
```

- [ ] **Step 4: Typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add app/api/companion lib/actions/companion.ts
git commit -m "feat(sync): POST /sync with device heartbeat and state; device-aware /default

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Companion CLI

**Files:**

- Modify: `companion/lib/state.mjs`
- Modify: `companion/bin/csync.mjs` (`HELP`, `tick`, `watch`, `launch`)
- Test: `companion/test/state.test.mjs`

**Interfaces:**

- Produces: `reportable(state, { waiting, failed })` in `state.mjs`.

- [ ] **Step 1: Failing test**

`companion/test/state.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { reportable } from "../lib/state.mjs";

const at = "2026-09-19T10:00:00.000Z";
const state = { applied: { cs2: { presetSlug: "main", version: "aaaa", at } } };

test("reportable tags applied, waiting and failed games", () => {
  assert.deepEqual(reportable(state), {
    cs2: { presetSlug: "main", version: "aaaa", at, status: "applied" },
  });
  assert.equal(reportable(state, { waiting: new Set(["cs2"]) }).cs2.status, "waiting");
  assert.equal(
    reportable(state, { waiting: new Set(["cs2"]), failed: new Set(["cs2"]) }).cs2.status,
    "failed",
  );
});
test("games that are waiting before any write are reported with empty fields", () => {
  const r = reportable(state, { waiting: new Set(["rocket-league"]) });
  assert.deepEqual(r["rocket-league"], { presetSlug: "", version: "", at: "", status: "waiting" });
});
test("a missing `at` (in-memory record) is sent as an empty string", () => {
  const r = reportable({ applied: { cs2: { presetSlug: "main", version: "aaaa" } } });
  assert.equal(r.cs2.at, "");
});
```

Run: `node --test companion/test/state.test.mjs` → fails (no export).

- [ ] **Step 2: Implement `reportable`**

Append to `companion/lib/state.mjs`:

```js
/** What the daemon reports to the vault: last write per game, tagged with this run's waiting/failed sets. */
export function reportable(state, { waiting = new Set(), failed = new Set() } = {}) {
  const out = {};
  const ids = new Set([...Object.keys(state.applied ?? {}), ...waiting, ...failed]);
  for (const id of ids) {
    const a = state.applied?.[id] ?? {};
    out[id] = {
      presetSlug: a.presetSlug ?? "",
      version: a.version ?? "",
      at: a.at ?? "",
      status: failed.has(id) ? "failed" : waiting.has(id) ? "waiting" : "applied",
    };
  }
  return out;
}
```

Run: `node --test companion/test/state.test.mjs` → 3 passed.

- [ ] **Step 3: Wire the daemon**

In `companion/bin/csync.mjs`:

- Import: `import { loadState, reportable } from "../lib/state.mjs";`
- `HELP` line for watch: `csync watch [--interval 30] [--once]    keep every game's files equal to the preset chosen for this PC (Pro); --install / --uninstall autostart`
- `tick(c, catalog, state, waiting, failed)`: replace the first try block's call with

```js
sync = await api(c).post("/sync", {
  device: c.device,
  platform: process.platform,
  applied: reportable(state, { waiting, failed }),
});
```

and the apply block with

```js
try {
  await applyPreset(c, game, target.presetSlug, { log: () => {}, version: target.version });
  state.applied[game.id] = { ...remote, at: new Date().toISOString() };
  waiting.delete(game.id);
  failed.delete(game.id);
  log(`applied "${target.presetName}" to ${game.name}`);
} catch (e) {
  failed.add(game.id);
  log(`failed to apply to ${game.name}: ${e.message}`);
}
```

- `watch()`: `const failed = new Set();`, pass it to `tick(c, catalog, state, waiting, failed)`, and the start line becomes ``log(`watching ${catalog.length} catalog games every ${interval / 1000}s as "${c.device}" (per-PC presets on)`);``
- `launch()`: ``const target = await api(c).get(`/default?game=${encodeURIComponent(g.id)}&device=${encodeURIComponent(c.device)}`);``

- [ ] **Step 4: Run the companion tests and a real tick against the dev server**

```bash
node --test "companion/test/**/*.test.mjs"
cat ~/.config/csync/config.json | python3 -c "import json,sys; c=json.load(sys.stdin); print(c['url'], c.get('device'))"
```

If the config points at `http://localhost:3000` and the dev server is running (`pnpm dev`), run `pnpm csync watch --once` and then:

```bash
docker exec settings_saver-db-1 psql -U gsv gsv -Atc "select name, platform, last_seen_at, applied::text from devices order by last_seen_at desc limit 3;"
```

Expected: a row for this hostname with `platform = linux`, a fresh `last_seen_at` and the `applied` JSON the daemon sent. If the config points elsewhere or the token is for another account, skip this and rely on Task 7's manual pass.

- [ ] **Step 5: Format and commit**

```bash
pnpm prettier --write companion/bin/csync.mjs companion/lib/state.mjs companion/test/state.test.mjs
git add companion
git commit -m "feat(csync): report device state on sync; per-PC target on launch

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Web — game page card, Settings devices, pricing copy

**Files:**

- Create: `components/games/device-presets-card.tsx`
- Modify: `app/(app)/games/[gameSlug]/page.tsx`
- Modify: `components/settings-page/companion-card.tsx` (devices list + Forget)
- Modify: `lib/billing/public.ts:22`

**Interfaces:**

- Consumes: `deviceRowsForGame`, `DeviceRow` (Task 3); `setDevicePresetAction`, `forgetDeviceAction` (Task 4); `getPlan`.

- [ ] **Step 1: The card**

`components/games/device-presets-card.tsx`:

```tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Monitor } from "lucide-react";
import { setDevicePresetAction } from "@/lib/actions/companion";
import type { DeviceRow } from "@/lib/data/devices";
import type { DeviceStatus } from "@/lib/companion/device-status";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastError } from "@/components/ui/toaster";
import { timeAgo } from "@/lib/utils/format";

type Props = {
  gameId: string;
  devices: DeviceRow[];
  presets: { id: string; name: string; isDefault: boolean }[];
};

export const PLATFORM_LABEL: Record<string, string> = {
  linux: "Linux",
  win32: "Windows",
  darwin: "macOS",
};
const DEFAULT = "default";

function statusText(s: DeviceStatus) {
  const name = s.kind !== "never" && s.presetSlug ? `${s.presetSlug} · ` : "";
  switch (s.kind) {
    case "never":
      return "never synced";
    case "applied":
      return `${name}applied ${timeAgo(s.at)}`;
    case "waiting":
      return `${name}waiting, game is running`;
    case "failed":
      return `${name}failed ${timeAgo(s.at)} — check the daemon log`;
    case "stale":
      return `${name}applied ${timeAgo(s.at)}, update pending`;
  }
}

/** Which preset each PC runs for this game, and what it last applied. */
export function DevicePresetsCard({ gameId, devices, presets }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const def = presets.find((p) => p.isDefault);

  const change = (device: DeviceRow, value: string) =>
    start(async () => {
      const presetId = value === DEFAULT ? null : value;
      const r = await setDevicePresetAction({ deviceId: device.id, gameId, presetId });
      if (!r.ok) return toastError(r.error);
      const label = presetId
        ? presets.find((p) => p.id === presetId)?.name
        : `Default (${def?.name ?? "none"})`;
      toast.success(`${device.name} will switch to ${label} on its next sync`);
      router.refresh();
    });

  return (
    <section className="mt-8 rounded-sm border border-line p-4">
      <h2 className="flex items-center gap-2 font-display text-lg">
        <Monitor className="size-4 text-ink-3" /> On your PCs
      </h2>
      <p className="mt-1 text-[13px] text-ink-2">
        Each PC running <code className="font-mono text-xs">csync watch</code> applies the preset
        chosen here, or the Default.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {devices.map((d) => (
          <li
            key={d.id}
            className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="truncate font-medium text-ink">{d.name}</span>
                {d.platform ? (
                  <span className="text-ink-3">{PLATFORM_LABEL[d.platform] ?? d.platform}</span>
                ) : null}
                {d.status.kind === "stale" ? <Badge variant="note">Pending</Badge> : null}
                {d.status.kind === "failed" ? <Badge variant="bad">Failed</Badge> : null}
              </div>
              <div className="text-xs text-ink-3">
                {statusText(d.status)} · seen {timeAgo(d.lastSeenAt)}
              </div>
            </div>
            <Select
              value={d.presetId ?? DEFAULT}
              onValueChange={(v) => change(d, v)}
              disabled={pending}
            >
              <SelectTrigger aria-label={`Preset for ${d.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT}>Default{def ? ` (${def.name})` : ""}</SelectItem>
                {presets
                  .filter((p) => !p.isDefault)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

(`Monitor` is in lucide-react; if the import fails, use `Laptop`.)

- [ ] **Step 2: Game page**

In `app/(app)/games/[gameSlug]/page.tsx` add imports:

```ts
import { getPlan } from "@/lib/billing/plan";
import { deviceRowsForGame } from "@/lib/data/devices";
import { DevicePresetsCard } from "@/components/games/device-presets-card";
```

Extend the `Promise.all`:

```ts
const [presets, profile, doc, , { plan }] = await Promise.all([
  listPresetsForGame(user.id, game.id),
  getProfile(user.id),
  exportGame(user.id, game.id),
  touchGameOpened(user.id, game.id),
  getPlan(user.id),
]);
const deviceRows =
  game.catalogId && plan === "pro"
    ? await deviceRowsForGame(user.id, { id: game.id, catalogId: game.catalogId })
    : [];
```

and after `<PresetList … />`:

```tsx
{
  deviceRows.length ? (
    <DevicePresetsCard
      gameId={game.id}
      devices={deviceRows}
      presets={presets
        .filter((p) => !p.isArchived)
        .map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault }))}
    />
  ) : null;
}
```

- [ ] **Step 3: Settings devices list with Forget**

In `components/settings-page/companion-card.tsx`: import `forgetDeviceAction` alongside the token actions and `PLATFORM_LABEL` from `@/components/games/device-presets-card`; add state `const [forgetting, setForgetting] = React.useState<Device | null>(null);`; replace the devices block with:

```tsx
{
  devices.length > 0 ? (
    <div>
      <p className="font-medium text-ink">Devices</p>
      <ul className="mt-1 divide-y divide-line">
        {devices.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-2">
            <span className="text-ink">{d.name}</span>
            <span className="text-ink-3">
              {d.platform ? `${PLATFORM_LABEL[d.platform] ?? d.platform} · ` : ""}
              {plural(d.games, "game")} · seen {timeAgo(d.lastSeenAt)}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setForgetting(d)}>
              Forget
            </Button>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
}
```

and add a second `ConfirmDialog` next to the revoke one:

```tsx
<ConfirmDialog
  open={forgetting != null}
  onOpenChange={(o) => !o && setForgetting(null)}
  title={`Forget “${forgetting?.name}”?`}
  description="Its scanned games and per-PC preset choices are removed. It comes back the next time csync talks to the vault."
  confirmLabel="Forget"
  loading={pending}
  onConfirm={() =>
    start(async () => {
      const r = await forgetDeviceAction(forgetting!.id);
      setForgetting(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Device forgotten");
    })
  }
/>
```

- [ ] **Step 4: Pricing copy**

`lib/billing/public.ts`: `"Cloud sync across your PCs (coming soon)"` → `"Per-PC presets: choose what each PC runs and see what's applied where"`.

- [ ] **Step 5: Typecheck, lint, format, build, commit**

```bash
pnpm typecheck && pnpm lint && pnpm prettier --write components/games/device-presets-card.tsx components/settings-page/companion-card.tsx "app/(app)/games/[gameSlug]/page.tsx" && pnpm build
git add components/games/device-presets-card.tsx components/settings-page/companion-card.tsx "app/(app)/games/[gameSlug]/page.tsx" lib/billing/public.ts
git commit -m "feat(sync): per-PC preset card on the game page; devices with Forget in Settings

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Docs, verification, PR

**Files:**

- Modify: `docs/companion.md` (command table row for `watch`, new section after "Background sync")

- [ ] **Step 1: Docs**

Command table: the `csync watch` row becomes
`| \`csync watch [--interval 30] [--once]\` | **Pro.** Keep every game's files equal to the preset chosen for this PC (or its Default). \`--install\` / \`--uninstall\` autostart. |`

Insert after the "Background sync" section:

```markdown
## Per-PC presets

Every `csync watch` tick is a `POST /api/companion/sync` that names this machine (`device` in
the config, the hostname by default), its platform and what it last applied per game. The vault
answers with the preset **this PC** should have: the one chosen for it on the game page ("On
your PCs"), otherwise the game's Default. Switch a laptop to a "Laptop" preset from your phone
and only that machine changes; the desktop keeps the Default.

The game page shows, per PC, what was last applied and when, whether an update is pending or
waiting for the game to close, and whether the last write failed. Settings → Companion lists
every PC that has talked to the vault, with a "Forget" button; a forgotten PC reappears the next
time it syncs.

`csync launch` asks for the same per-PC target, so Steam launch options honour the choice too.
```

Run `pnpm prettier --write docs/companion.md`.

- [ ] **Step 2: Full check**

```bash
pnpm check && node --test "companion/test/**/*.test.mjs" && pnpm format:check && pnpm build
```

- [ ] **Step 3: Manual verification (dev server running, demo account is Pro)**

1. Make sure this machine is a known device: `pnpm csync watch --once` (config must point at `http://localhost:3000` with a token of `demo@example.com`; otherwise `pnpm csync login http://localhost:3000` with a token from Settings → Companion first).
2. Open `/games/counter-strike-2`: the "On your PCs" card lists this hostname with "Linux", status and "seen just now"; the select shows `Default (Default)`.
3. Choose "cli-check" → toast "<host> will switch to cli-check on its next sync". `pnpm csync watch --once` logs `applied "cli-check" to Counter-Strike 2`; a `.bak-*` sits next to the CS2 file. Reload the page: status "cli-check · applied just now".
4. Choose `Default (…)` again → `--once` applies the Default. Card shows the Default applied.
5. `GET /api/companion/sync` with the token still returns Default targets (legacy path).
6. Settings → Companion: device row with "Forget"; forget it; run `--once`; it is back.
7. Sign in as `miguel@example.com` (Free): no card on any game page.
8. Restore the CS2 config from the newest `.bak-*`.

- [ ] **Step 4: Commit, push, open the stacked PR**

```bash
git add docs/companion.md
git commit -m "docs: per-PC presets

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin feat/multi-pc-sync
gh pr create --base feat/ai-screenshot-importer --title "feat(sync): per-PC presets and device status" --body "$(cat <<'EOF'
## Summary
- Stacked on #5 (migration numbering). Retarget to `main` once #5 merges — merge #5 **without** `--delete-branch`, or retarget this PR first.
- New `devices` (heartbeat + last applied state) and `device_presets` (per-PC preset choice) tables; existing scans backfilled.
- `csync watch` now `POST /sync` with device, platform and its state; the server answers with the preset **this PC** should have (choice → else Default). `decide()` unchanged. `csync launch` honours the choice too. Legacy `GET /sync` still works.
- Game page (Pro, catalog games): "On your PCs" card — pick a preset per PC, see applied / pending / waiting / failed with timestamps.
- Settings → Companion: devices come from the new table with platform, last seen and Forget.
- Pricing: "Cloud sync across your PCs (coming soon)" → "Per-PC presets…".

## Test plan
- [ ] `pnpm check`, companion `node --test`, `pnpm build`
- [ ] Manual: choose "cli-check" for this PC → `csync watch --once` applies it; back to Default → applies the Default
- [ ] Free account sees no card; `GET /sync` legacy path unchanged

Spec: `docs/superpowers/specs/2026-09-19-multi-pc-sync-design.md` · Plan: `docs/superpowers/plans/2026-09-19-multi-pc-sync.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Do not merge; Miguel reviews on GitHub.
