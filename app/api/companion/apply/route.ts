import { z } from "zod";
import { patchConfigFiles } from "@/lib/data/catalog";
import { catalogIdSchema, configFilesSchema } from "@/lib/validation";
import { companionRoute } from "@/lib/api/companion";

const body = z.object({
  catalogId: catalogIdSchema,
  presetSlug: z.string().min(1).max(120),
  files: configFilesSchema,
});

/** Returns the files patched with the preset's values; the companion writes them after a backup. */
export const POST = companionRoute(body, (v, userId) => patchConfigFiles(userId, v));
