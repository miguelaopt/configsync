/**
 * Seeds a demo account with the example library (docs/examples/demo-library.json).
 *   pnpm db:seed            → creates demo@example.com / demo-vault-2026 if missing, then imports
 *   pnpm db:seed --force    → imports again even if the demo user already has games
 */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";

try {
  process.loadEnvFile(".env");
} catch {
  /* optional */
}

const DEMO_EMAIL = process.env.SEED_EMAIL ?? "demo@example.com";
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "demo-vault-2026";
const DEMO_NAME = "Demo Player";

async function main() {
  const { auth } = await import("@/lib/auth");
  const { db, schema } = await import("@/lib/db");
  const { parseImportFile } = await import("@/lib/import-export/parse");
  const { importFile } = await import("@/lib/data/import");

  let user = await db.query.users.findFirst({ where: eq(schema.users.email, DEMO_EMAIL) });
  if (!user) {
    const res = await auth.api.signUpEmail({
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: DEMO_NAME },
    });
    user = (await db.query.users.findFirst({ where: eq(schema.users.id, res.user.id) }))!;
    console.log(`[seed] created ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
  } else {
    console.log(`[seed] ${DEMO_EMAIL} already exists`);
  }

  const existing = await db.query.games.findFirst({ where: eq(schema.games.userId, user.id) });
  if (existing && !process.argv.includes("--force")) {
    console.log("[seed] demo user already has games — skipping import (use --force to add again)");
    return;
  }

  const raw = readFileSync(new URL("../docs/examples/demo-library.json", import.meta.url), "utf8");
  const parsed = parseImportFile(raw);
  if (!parsed.ok) throw new Error(`demo-library.json is invalid:\n${parsed.errors.join("\n")}`);
  const outcome = await importFile(user.id, parsed.file);
  console.log(
    `[seed] imported ${outcome.createdGames.length} games, ${outcome.createdPresets} presets, ${outcome.createdSettings} settings`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
