export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEnvOrExit } = await import("@/lib/boot");
  await assertEnvOrExit();

  if (process.env.RUN_MIGRATIONS === "true") {
    const { runMigrations } = await import("@/lib/db/migrate");
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required to run migrations");
    console.log("[csync] applying database migrations…");
    await runMigrations(url);
    console.log("[csync] migrations applied");
  }

  if (process.env.DATABASE_URL) {
    const { parseAdminEmails, syncAdmins } = await import("@/lib/db/admins");
    const emails = parseAdminEmails(process.env.ADMIN_EMAILS);
    await syncAdmins(process.env.DATABASE_URL, emails);
    console.log(`[csync] admins: ${emails.length}`);
  }
}
