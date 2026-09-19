import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { deviceRowsForGame } from "./devices";

const { devices } = schema;

export type SyncLabel = "synced" | "pending" | "never" | "failed";

export const SYNC_COPY: Record<SyncLabel, string> = {
  synced: "Synced",
  pending: "Changes to apply",
  failed: "Failed",
  never: "Not applied",
};

/** The PCs that have reported in, newest heartbeat first. */
export async function listDeviceState(userId: string, limit = 8) {
  return db
    .select({
      id: devices.id,
      name: devices.name,
      platform: devices.platform,
      lastSeenAt: devices.lastSeenAt,
      applied: devices.applied,
    })
    .from(devices)
    .where(eq(devices.userId, userId))
    .orderBy(desc(devices.lastSeenAt))
    .limit(limit);
}

/** Worst status wins: a failure or a pending change is what the user needs to see. */
export function summarise(kinds: string[]): SyncLabel {
  if (kinds.length === 0 || kinds.every((k) => k === "never")) return "never";
  if (kinds.includes("failed")) return "failed";
  if (kinds.some((k) => k === "stale" || k === "waiting")) return "pending";
  return "synced";
}

export function overallSync(labels: SyncLabel[]): SyncLabel | null {
  if (labels.length === 0) return null;
  if (labels.includes("failed")) return "failed";
  if (labels.includes("pending")) return "pending";
  if (labels.every((l) => l === "never")) return "never";
  return "synced";
}

/**
 * Sync state per game, keyed by game id. Only catalog games can be synced at all.
 *
 * ponytail: one preset fingerprint per device per game. Fine for a personal library; if someone
 * shows up with 200 games, cache the fingerprint per (game, version) instead of computing it here.
 */
export async function syncLabelsForGames(
  userId: string,
  games: { id: string; catalogId: string | null }[],
  hasDevices: boolean,
): Promise<Map<string, SyncLabel>> {
  const out = new Map<string, SyncLabel>();
  if (!hasDevices) return out;
  await Promise.all(
    games
      .filter((g) => g.catalogId)
      .map(async (g) => {
        const rows = await deviceRowsForGame(userId, { id: g.id, catalogId: g.catalogId! });
        out.set(g.id, summarise(rows.map((r) => r.status.kind)));
      }),
  );
  return out;
}

/**
 * How many PCs currently have each preset of a game applied. Read straight from what the
 * devices reported, so it costs nothing extra.
 */
export function devicesByPreset(
  applied: { applied: Record<string, { presetSlug: string; status: string }> }[],
  catalogId: string | null,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!catalogId) return out;
  for (const d of applied) {
    const a = d.applied?.[catalogId];
    if (!a || a.status === "failed") continue;
    out.set(a.presetSlug, (out.get(a.presetSlug) ?? 0) + 1);
  }
  return out;
}
