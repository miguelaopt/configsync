import "server-only";
import { and, count, desc, eq, ilike, max } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { deviceGames } = schema;
export type DeviceGameInput = {
  source: "steam" | "epic";
  appId: string;
  name: string;
  installDir?: string | null;
};

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

export async function listDevices(userId: string) {
  return db
    .select({ device: deviceGames.device, games: count(), seenAt: max(deviceGames.seenAt) })
    .from(deviceGames)
    .where(eq(deviceGames.userId, userId))
    .groupBy(deviceGames.device)
    .orderBy(desc(max(deviceGames.seenAt)));
}
