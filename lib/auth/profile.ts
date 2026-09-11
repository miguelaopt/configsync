import { db, schema } from "@/lib/db";
import { slugify } from "@/lib/utils/slug";

const RESERVED = new Set(["admin", "api", "app", "p", "me", "settings", "login", "signup"]);

export function usernameCandidate(name: string, email: string) {
  const base = slugify(name) || slugify(email.split("@")[0] ?? "") || "player";
  return RESERVED.has(base) ? `${base}-1` : base;
}

/** Creates the profile row for a freshly registered user, picking a unique username. */
export async function createProfileForUser(user: { id: string; name: string; email: string }) {
  const base = usernameCandidate(user.name, user.email).slice(0, 32);
  for (let attempt = 0; attempt < 5; attempt++) {
    const username = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const inserted = await db
      .insert(schema.profiles)
      .values({ userId: user.id, username, displayName: user.name })
      .onConflictDoNothing({ target: schema.profiles.username })
      .returning({ userId: schema.profiles.userId });
    if (inserted.length > 0) return;
  }
  // Extremely unlikely; fall back to the user id which is unique by construction.
  await db
    .insert(schema.profiles)
    .values({ userId: user.id, username: `player-${user.id.slice(0, 8)}`, displayName: user.name })
    .onConflictDoNothing();
}
