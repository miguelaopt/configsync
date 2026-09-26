import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth/companion-token";

const { companionTokens, users } = schema;

/** Returns the plaintext token once; only its hash is stored. */
export async function createCompanionToken(userId: string, name: string) {
  const { token, hash } = generateToken();
  const [row] = await db
    .insert(companionTokens)
    .values({ userId, name, tokenHash: hash })
    .returning({ id: companionTokens.id });
  return { id: row!.id, name, token };
}

export function listCompanionTokens(userId: string) {
  return db.query.companionTokens.findMany({
    where: eq(companionTokens.userId, userId),
    columns: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: (t, { desc }) => desc(t.createdAt),
  });
}

export async function revokeCompanionToken(userId: string, id: string) {
  await db
    .delete(companionTokens)
    .where(and(eq(companionTokens.userId, userId), eq(companionTokens.id, id)));
}

/**
 * Resolves a bearer token to its user and stamps last_used_at; null when unknown or when the
 * account is suspended (a ban revokes tokens too, but this holds even if one survived it).
 */
export async function userIdForToken(token: string) {
  if (!token.startsWith("csync_")) return null;
  const [row] = await db
    .update(companionTokens)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(companionTokens.tokenHash, hashToken(token)),
        sql`not exists (select 1 from ${users} u where u.id = ${companionTokens.userId} and u.banned is true and (u.ban_expires is null or u.ban_expires > now()))`,
      ),
    )
    .returning({ userId: companionTokens.userId });
  return row?.userId ?? null;
}
