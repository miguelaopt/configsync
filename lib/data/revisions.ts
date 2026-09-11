import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notFound } from "./errors";
import { getPresetFull, insertCategoriesFromDocs, toPresetDoc } from "./presets";
import { presetDocSchema, type PresetDoc } from "@/lib/import-export/schema";

const { revisions, categories } = schema;
const KEEP_PER_PRESET = 50;

/** Snapshots the current preset state. Called after meaningful saves. */
export async function createRevision(userId: string, presetId: string, note?: string | null) {
  const preset = await getPresetFull(userId, presetId);
  const snapshot = toPresetDoc(preset);
  await db.transaction(async (tx) => {
    await tx.insert(revisions).values({ presetId, userId, snapshot, note: note ?? null });
    // ponytail: keep the last N snapshots; a retention policy can replace this later.
    const stale = await tx
      .select({ id: revisions.id })
      .from(revisions)
      .where(eq(revisions.presetId, presetId))
      .orderBy(desc(revisions.createdAt))
      .offset(KEEP_PER_PRESET);
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
    .limit(KEEP_PER_PRESET);
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
