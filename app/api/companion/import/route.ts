import { z } from "zod";
import { revalidatePath } from "next/cache";
import { importConfigFiles } from "@/lib/data/catalog";
import { touchDevice } from "@/lib/data/devices";
import { catalogIdSchema, configFilesSchema } from "@/lib/validation";
import { companionRoute } from "@/lib/api/companion";

const body = z.object({
  catalogId: catalogIdSchema,
  device: z.string().trim().max(60).optional(),
  files: configFilesSchema,
  name: z.string().trim().max(80).optional(),
});

export const POST = companionRoute(body, async (v, userId) => {
  if (v.device) await touchDevice(userId, v.device);
  const r = await importConfigFiles(userId, v);
  revalidatePath("/", "layout");
  const { preset: _p, ...read } = r.read;
  return {
    url: `/games/${r.gameSlug}/${r.presetSlug}`,
    gameSlug: r.gameSlug,
    presetSlug: r.presetSlug,
    ...read,
  };
});
