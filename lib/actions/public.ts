"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPublicPreset } from "@/lib/data/public";
import { importFile } from "@/lib/data/import";
import { getGameBySlug } from "@/lib/data/games";
import { AppError } from "@/lib/data/errors";
import { uniqueSlug } from "@/lib/utils/slug";
import { runAction } from "./shared";

const slug = z.string().min(1).max(120);
const input = z.object({ username: slug, gameSlug: slug, presetSlug: slug });

/** Copies a public preset into the signed-in user's vault as a new preset. */
export async function saveToVaultAction(raw: unknown) {
  return runAction(input, raw, async (v, userId) => {
    const pub = await getPublicPreset(v.username, v.gameSlug, v.presetSlug);
    if (!pub) throw new AppError("That preset isn't public any more.", "not_found");
    const outcome = await importFile(userId, {
      format: "gamesettings-vault",
      version: 1,
      kind: "preset",
      games: [pub.doc],
    });
    revalidatePath("/", "layout");
    // importFile put the preset either in a new game or in the viewer's game with the same slug.
    const gameSlug =
      outcome.createdGames[0]?.slug ??
      (await getGameBySlug(userId, uniqueSlug(pub.doc.name, [])))?.slug ??
      "";
    return { url: `/games/${gameSlug}/${outcome.createdPresetSlugs[0]}` };
  });
}
