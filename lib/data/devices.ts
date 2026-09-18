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
