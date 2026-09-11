/** Drops all application data (dev only). Usage: pnpm db:reset */
try {
  process.loadEnvFile(".env");
} catch {
  /* optional */
}
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset a production database.");
  process.exit(1);
}
const { db } = await import("@/lib/db");
const { sql } = await import("drizzle-orm");
await db.execute(
  sql`truncate table users, profiles, attachments, games, presets, categories, settings, revisions, sessions, accounts, verifications restart identity cascade`,
);
console.log("[reset] all tables truncated");
process.exit(0);
export {};
