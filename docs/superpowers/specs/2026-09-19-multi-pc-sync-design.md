# Multi-PC sync — design

**Status:** approved 2026-09-19 · **Builds on:** `feat/ai-screenshot-importer` (PR #5; migration
numbering continues from `0004_ai_requests`)

## Goal

A Pro user with several PCs chooses, from the web app, which preset each PC runs for each
game, and sees what is applied where. The daemon (`csync watch`) keeps its logic; it just
identifies itself and reports its state, and the server answers with the preset that PC should
have — the per-device choice when one exists, otherwise the game's Default.

## Product decisions

| Decision      | Choice                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Override      | `device_presets(device_id, game_id, preset_id)`. No row ⇒ Default. Archived/deleted preset ⇒ Default again. |
| Devices       | New `devices` table, upserted by every companion call that carries a device name; `last_seen_at` heartbeat. |
| Applied state | The daemon posts its `state.json` (`applied` + `waiting`) each tick; stored as `devices.applied` jsonb.     |
| Identity      | Device = the CLI's `device` (hostname by default), unique per user. Renaming is out of scope.               |
| `/sync`       | Becomes `POST { device, platform, applied }`; `GET` keeps working (Default only, no heartbeat).             |
| `/default`    | Gains `&device=` so `csync launch` also honours the override.                                               |
| Web           | Game page card "On your PCs" (Pro, catalog games). Settings → Companion lists `devices` with "Forget".      |
| Gating        | Card and `setDevicePresetAction` are Pro (`getPlan`). `/sync` is already Pro. Free sees nothing new.        |
| Out of scope  | Two-way sync (auto-import from the PC), renaming devices, per-device Defaults for non-catalog games, macOS. |

## A. Data

`lib/db/schema.ts`:

```ts
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
    /** Mirror of the daemon's state.json: { [catalogId]: { presetSlug, version, at, status } }. */
    applied: jsonb("applied").$type<DeviceApplied>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("devices_user_name_uq").on(t.userId, t.name)],
);

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

`DeviceApplied = Record<string, { presetSlug: string; version: string; at: string; status: "applied" | "waiting" | "failed" }>`
lives in `lib/db/schema.ts` next to the table (it is a column type).

Migration `0005_devices` (generated, then one hand-written statement appended before the final
breakpoint): backfill from scans so existing devices show up immediately —

```sql
INSERT INTO "devices" ("user_id", "name", "last_seen_at")
SELECT "user_id", "device", max("seen_at") FROM "device_games" GROUP BY 1, 2
ON CONFLICT DO NOTHING;
```

`device_games.device` stays a text name; the two tables join on `(user_id, name)`.

## B. Server

`lib/data/devices.ts` gains:

- `touchDevice(userId, name, opts?: { platform?: string | null; applied?: DeviceApplied })` →
  upsert on `(user_id, name)`: sets `last_seen_at = now()`, `platform` when given, `applied` when
  given; returns the row. Called by `/sync` (POST), `/devices` (PUT), `/import` (when `device`
  is present) and `/default` (when `device` is present).
- `listDevices(userId)` now reads `devices` left-joined with a `device_games` count:
  `{ id, name, platform, lastSeenAt, games }[]`, newest `last_seen_at` first.
- `forgetDevice(userId, deviceId)` → deletes the `devices` row (cascades `device_presets`) and the
  `device_games` rows with the same name.
- `listDevicesForGame(userId, gameId)` → `{ id, name, platform, lastSeenAt, applied, presetId: string | null }[]`
  (left join `device_presets` on this game) for the card.
- `setDevicePreset(userId, deviceId, gameId, presetId | null)` → null deletes the override;
  otherwise asserts the preset belongs to the user and to `gameId`, then upserts.

`lib/data/catalog.ts`:

- `defaultPresetFor(userId, catalogId, device?: string)` → when `device` is given and a
  `device_presets` row exists for that device + game whose preset is not archived, that preset is
  the target and `source: "device"`; otherwise the Default and `source: "default"`. `SyncTarget`
  gains `source`.
- `listSyncTargets(userId, device?: string)` passes `device` through.

Routes:

- `app/api/companion/sync/route.ts` — `GET` unchanged (no device). New `POST` with body
  `{ device: string (1–60), platform?: "linux" | "win32" | "darwin", applied?: DeviceApplied }`:
  Pro check → `touchDevice(userId, device, { platform, applied })` → `{ games: await listSyncTargets(userId, device) }`.
  `applied` is validated with `z.record(z.string().max(60), z.object({ presetSlug: z.string().max(120), version: z.string().max(64), at: z.string().max(40), status: z.enum(["applied","waiting","failed"]) }))` and capped at 200 keys.
- `app/api/companion/default/route.ts` — reads `&device=`; when present, `touchDevice` (no
  platform/state) and `defaultPresetFor(userId, game, device)`.
- `app/api/companion/devices/route.ts` and `/import` — call `touchDevice` with the device name
  they already receive.

`lib/actions/companion.ts` gains `setDevicePresetAction({ deviceId, gameId, presetId })` and
`forgetDeviceAction(deviceId)`; the first throws `AppError("Per-PC presets are a Pro feature — upgrade to Pro to use them.", "forbidden")` unless `getPlan(userId).plan === "pro"`.
Both `revalidatePath("/", "layout")`.

## C. Companion

`companion/bin/csync.mjs`:

- `tick()` posts instead of getting: `api(c).post("/sync", { device: c.device, platform: process.platform, applied: reportable(state, { waiting, failed }) })`
  where `reportable` (in `companion/lib/state.mjs`) maps each `state.applied[id]` to
  `{ presetSlug, version, at, status }` with `status` = `"failed"` when `failed.has(id)`, else
  `"waiting"` when `waiting.has(id)`, else `"applied"`. `failed` is an in-memory `Set` like
  `waiting` (a failed apply adds the id; a success deletes it); `state.json` stays "what was last
  written".
- `launch()` fetches `/default?game=<id>&device=<encoded device>`.
- Log line on start becomes `watching N catalog games every Ns as "<device>" (per-PC presets on)`.

`companion/lib/sync.mjs` — unchanged. `decide()` only compares `presetSlug`/`version`, so an
override change arrives as a new `version` and applies on the next tick.

## D. Web

`components/games/device-presets-card.tsx` (client) on the game page, under `PresetList`,
rendered only when `game.catalogId` is set **and** the plan is Pro **and** at least one device
exists. Props: `gameId`, `devices: { id, name, platform, lastSeenAt, presetId, status: DeviceStatus }[]`,
`presets: { id, name, isDefault }[]` (active only). The page computes `status` server-side with
`deviceStatus()` (pure) and passes it down; the client never sees raw `applied`.

Each row: device name (+ `platform` as muted text: "Linux" / "Windows" / "macOS"), a `Select`
whose first option is `Default (<name of the Default preset>)` (value `"default"`) followed by
the other active presets, and a status line from `deviceStatus()`:

```ts
// lib/companion/device-status.ts (pure, tested)
export type DeviceStatus =
  | { kind: "never" }
  | { kind: "applied"; presetSlug: string; at: string }
  | { kind: "waiting"; presetSlug: string }
  | { kind: "failed"; presetSlug: string; at: string }
  | { kind: "stale"; presetSlug: string; at: string }; // applied ≠ what the server now wants
export function deviceStatus(
  applied: DeviceApplied[string] | undefined,
  want: { presetSlug: string; version: string } | null,
): DeviceStatus;
```

Rendered as: never → "never synced"; applied → "<preset> · applied <timeAgo>"; waiting →
"<preset> · waiting, game is running"; failed → "<preset> · failed <timeAgo> — check the daemon
log"; stale → "<preset> · applied <timeAgo>, update pending" (`Badge variant="note"`). The card
gets `want` per device from the server via `defaultPresetFor(userId, catalogId, device.name)`.

Changing the select calls `setDevicePresetAction`; success toasts "<device> will switch to
<preset> on its next sync".

Settings → Companion card: the Devices list shows `name · platform · N games · last seen
<timeAgo>` and a "Forget" ghost button per row (`ConfirmDialog`, then `forgetDeviceAction`).

Pricing (`lib/billing/public.ts`): "Cloud sync across your PCs (coming soon)" →
"Per-PC presets: choose what each PC runs and see what's applied where".

Docs: `docs/companion.md` — new section "Per-PC presets" and the `/sync` POST shape;
`docs/catalog.md` untouched.

## Errors and safety

- Every device row is scoped by `user_id`; `touchDevice` never trusts an id from the client, only
  the name, and only for the authenticated token's user.
- `setDevicePreset` verifies preset ownership and `preset.gameId === gameId` before writing.
- `applied` from the daemon is data: bounded size, validated shape, rendered as text only.
- `/sync` POST from a Free account is refused before any write (403, same sentence as today).
- The daemon still never writes while the game runs and never without a backup (unchanged).

## Tests

- `tests/device-status.test.ts` — `deviceStatus()` matrix: undefined → never; same slug+version →
  applied; waiting status → waiting; failed → failed; different version → stale.
- `tests/catalog.test.ts` or a new `tests/sync-target.test.ts` — the pure resolver
  `pickTarget({ override, default })` used by `defaultPresetFor`: override wins when present and
  not archived; otherwise Default; `source` set accordingly.
- `companion/test/state.test.mjs` — `reportable(state, { waiting, failed })` marks waiting and
  failed games and keeps the others as applied.
- Manual on this machine (demo account is Pro): open CS2 in the web app → card shows this
  hostname; choose "cli-check" → `pnpm csync watch --once` logs `applied "cli-check"`; Settings
  shows "last seen just now"; switch back to Default → `--once` applies the Default; Free account
  (`miguel@example.com`) sees no card. Restore game files from the `.bak-*` afterwards.
