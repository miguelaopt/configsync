import { companionRoute } from "@/lib/api/companion";
import { defaultPresetFor } from "@/lib/data/catalog";
import { touchDevice } from "@/lib/data/devices";
import { AppError } from "@/lib/data/errors";
import { catalogIdSchema } from "@/lib/validation";

/** The preset one catalog game should have on this PC — for `csync launch`. Free. */
export const GET = companionRoute(null, async (_i, userId, req) => {
  const params = new URL(req.url).searchParams;
  const game = catalogIdSchema.safeParse(params.get("game"));
  if (!game.success) throw new AppError("Pass ?game=<catalog id>.", "invalid");
  const device = params.get("device")?.trim().slice(0, 60) || null;
  if (device) await touchDevice(userId, device);
  const target = await defaultPresetFor(userId, game.data, device);
  if (!target)
    throw new AppError(`You don't have a Default preset for ${game.data} yet.`, "not_found");
  return target;
});
