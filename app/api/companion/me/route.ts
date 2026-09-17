import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { companionRoute } from "@/lib/api/companion";
import { getPlan } from "@/lib/billing/plan";

export const GET = companionRoute(null, async (_i, userId) => {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { id: true, name: true, email: true },
  });
  return { user, plan: (await getPlan(userId)).plan };
});
