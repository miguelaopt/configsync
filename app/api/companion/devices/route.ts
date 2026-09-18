import { z } from "zod";
import { replaceDeviceGames, touchDevice } from "@/lib/data/devices";
import { companionRoute } from "@/lib/api/companion";

const body = z.object({
  device: z.string().trim().min(1).max(60),
  games: z
    .array(
      z.object({
        source: z.enum(["steam", "epic"]),
        appId: z.string().min(1).max(80),
        name: z.string().trim().min(1).max(200),
        installDir: z.string().max(500).nullish(),
      }),
    )
    .max(2000),
});

/** A scan replaces everything known about that device. */
export const PUT = companionRoute(body, async (v, userId) => {
  await touchDevice(userId, v.device);
  return { stored: await replaceDeviceGames(userId, v.device, v.games) };
});
