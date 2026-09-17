export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RUN_MIGRATIONS === "true") {
    const { runMigrations } = await import("@/lib/db/migrate");
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required to run migrations");
    console.log("[csync] applying database migrations…");
    await runMigrations(url);
    console.log("[csync] migrations applied");
  }
}
