import { companionRoute } from "@/lib/api/companion";
import { getPlan } from "@/lib/billing/plan";
import { listSyncTargets } from "@/lib/data/catalog";
import { AppError } from "@/lib/data/errors";
import { env } from "@/lib/env";

/** What `csync watch` polls: the Default preset of every owned catalog game. Pro only. */
export const GET = companionRoute(null, async (_i, userId) => {
  if ((await getPlan(userId)).plan !== "pro")
    throw new AppError(
      `Auto-switch is a Pro feature. Upgrade at ${env.NEXT_PUBLIC_APP_URL}/pricing.`,
      "forbidden",
    );
  return { games: await listSyncTargets(userId) };
});
