import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notFound } from "./errors";
import { getPresetFull, insertCategoriesFromDocs, toPresetDoc } from "./presets";
import { presetDocSchema, type PresetDoc } from "@/lib/import-export/schema";
import { getPlan } from "@/lib/billing/plan";
import { limitsFor } from "@/lib/billing/limits";

const { revisions, categories } = schema;
/** Display cap for the history dialog; retention itself is a plan limit (lib/billing/limits). */
const LIST_MAX = 200;

/** Snapshots the current preset state. Called after meaningful saves. */
export async function createRevision(userId: string, presetId: string, note?: string | null) {
  const preset = await getPresetFull(userId, presetId);
  const snapshot = toPresetDoc(preset);
  const keep = limitsFor((await getPlan(userId)).plan).revisions;
  await db.transaction(async (tx) => {
    await tx.insert(revisions).values({ presetId, userId, snapshot, note: note ?? null });
    if (keep === Infinity) return; // Pro keeps everything
    const stale = await tx
      .select({ id: revisions.id })
      .from(revisions)
      .where(eq(revisions.presetId, presetId))
      .orderBy(desc(revisions.createdAt))
      .offset(keep);
    if (stale.length > 0) {
      await tx.delete(revisions).where(
        inArray(
          revisions.id,
          stale.map((r) => r.id),
        ),
      );
    }
  });
}

export async function listRevisions(userId: string, presetId: string) {
  const rows = await db
    .select({
      id: revisions.id,
      note: revisions.note,
      createdAt: revisions.createdAt,
      settingCount: sql<number>`(
        select coalesce(sum(jsonb_array_length(c->'settings')), 0)
        from jsonb_array_elements(${revisions.snapshot}->'categories') c
      )`,
    })
    .from(revisions)
    .where(and(eq(revisions.userId, userId), eq(revisions.presetId, presetId)))
    .orderBy(desc(revisions.createdAt))
    .limit(LIST_MAX);
  return rows.map((r) => ({ ...r, settingCount: Number(r.settingCount) }));
}

export async function getRevisionDoc(userId: string, revisionId: string): Promise<PresetDoc> {
  const row = await db.query.revisions.findFirst({
    where: and(eq(revisions.userId, userId), eq(revisions.id, revisionId)),
  });
  if (!row) throw notFound("revision");
  return presetDocSchema.parse(row.snapshot);
}

/** Replaces the preset's categories/settings with a snapshot; the current state is saved first. */
export async function restoreRevision(userId: string, presetId: string, revisionId: string) {
  const doc = await getRevisionDoc(userId, revisionId);
  await createRevision(userId, presetId, "Before restore");
  await db.transaction(async (tx) => {
    await tx
      .delete(categories)
      .where(and(eq(categories.presetId, presetId), eq(categories.userId, userId)));
    await insertCategoriesFromDocs(tx, userId, presetId, doc.categories);
  });
}

/** Recent saves across every preset of one game, for the game page's activity panel. */
export async function listGameActivity(userId: string, gameId: string, limit = 6) {
  const { presets } = schema;
  return db
    .select({
      id: revisions.id,
      note: revisions.note,
      createdAt: revisions.createdAt,
      presetName: presets.name,
      presetSlug: presets.slug,
    })
    .from(revisions)
    .innerJoin(presets, eq(presets.id, revisions.presetId))
    .where(and(eq(revisions.userId, userId), eq(presets.gameId, gameId)))
    .orderBy(desc(revisions.createdAt))
    .limit(limit);
}
