import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";

/** Current session (memoised per request). */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Redirects to sign-in when unauthenticated. Use in pages/layouts. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

/** Throws when unauthenticated. Use in server actions / route handlers. */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session.user.id;
}

/**
 * The signed-in admin, or a 404 for everyone else: /admin does not exist for them. While an admin
 * views the app as someone else, the session is that user's, so /admin is gone until they stop.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (session?.user.role !== "admin") notFound();
  return session.user;
}

export class UnauthorizedError extends Error {
  constructor(message = "You need to sign in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export const getProfile = cache(async (userId: string) => {
  const rows = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
});
