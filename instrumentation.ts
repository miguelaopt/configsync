export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Read the environment here so a bad deploy dies at boot with one clear line, instead of
  // every request throwing the same error behind a bare "Internal Server Error".
  // The container then restart-loops and Caddy serves the maintenance page.
  try {
    await import("@/lib/env");
  } catch (err) {
    console.error(`[csync] ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (process.env.RUN_MIGRATIONS === "true") {
    const { runMigrations } = await import("@/lib/db/migrate");
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required to run migrations");
    console.log("[csync] applying database migrations…");
    await runMigrations(url);
    console.log("[csync] migrations applied");
  }
}
