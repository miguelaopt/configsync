import postgres from "postgres";

/** `ADMIN_EMAILS=a@x.com, b@y.com` → normalised list. */
export const parseAdminEmails = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * Makes `users.role` match ADMIN_EMAILS: listed accounts become admin, anyone else loses it. Runs
 * at boot, so the env is the only place admins are decided and removing an email takes effect on
 * the next restart. No `server-only` here: instrumentation.ts imports it.
 */
export async function syncAdmins(databaseUrl: string, emails: string[]) {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql`
      update users set role = case when lower(email) in ${sql(emails.length ? emails : [""])} then 'admin' else null end
      where role = 'admin' or lower(email) in ${sql(emails.length ? emails : [""])}`;
  } finally {
    await sql.end();
  }
}
