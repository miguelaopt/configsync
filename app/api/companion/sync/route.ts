import { z } from "zod";
import { companionRoute } from "@/lib/api/companion";
import { getPlan } from "@/lib/billing/plan";
import { listSyncTargets } from "@/lib/data/catalog";
import { touchDevice } from "@/lib/data/devices";
import { AppError } from "@/lib/data/errors";
import { env } from "@/lib/env";

async function assertPro(userId: string) {
  if ((await getPlan(userId)).plan !== "pro")
    throw new AppError(
      `Auto-switch is a Pro feature. Upgrade at ${env.NEXT_PUBLIC_APP_URL}/pricing.`,
      "forbidden",
    );
}

/** Legacy poll without device identity: the Default preset of every owned catalog game. Pro only. */
export const GET = companionRoute(null, async (_i, userId) => {
  await assertPro(userId);
  return { games: await listSyncTargets(userId) };
});

const appliedSchema = z
  .record(
    z.string().max(60),
    z.object({
      presetSlug: z.string().max(120),
      version: z.string().max(64),
      at: z.string().max(40).default(""),
      status: z.enum(["applied", "waiting", "failed"]),
    }),
  )
  .refine((r) => Object.keys(r).length <= 200, "Too many games");
const body = z.object({
  device: z.string().trim().min(1).max(60),
  platform: z.string().max(20).optional(),
  applied: appliedSchema.optional(),
});

/** What `csync watch` polls: records the device and its state, answers with each game's preset for this PC. Pro only. */
export const POST = companionRoute(body, async (v, userId) => {
  await assertPro(userId);
  await touchDevice(userId, v.device, { platform: v.platform, applied: v.applied });
  return { games: await listSyncTargets(userId, v.device) };
});
