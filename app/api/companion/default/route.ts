import { companionRoute } from "@/lib/api/companion";
import { defaultPresetFor } from "@/lib/data/catalog";
import { AppError } from "@/lib/data/errors";
import { catalogIdSchema } from "@/lib/validation";

/** The Default preset of one catalog game — for `csync launch`. Free. */
export const GET = companionRoute(null, async (_i, userId, req) => {
  const game = catalogIdSchema.safeParse(new URL(req.url).searchParams.get("game"));
  if (!game.success) throw new AppError("Pass ?game=<catalog id>.", "invalid");
  const target = await defaultPresetFor(userId, game.data);
  if (!target)
    throw new AppError(`You don't have a Default preset for ${game.data} yet.`, "not_found");
  return target;
});
