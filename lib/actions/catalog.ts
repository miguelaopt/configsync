"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createGameFromCatalog } from "@/lib/data/catalog";
import { runAction } from "./shared";

export async function createGameFromCatalogAction(catalogId: string) {
  return runAction(z.object({ catalogId: z.string().min(1) }), { catalogId }, async (v, userId) => {
    const game = await createGameFromCatalog(userId, v.catalogId);
    revalidatePath("/", "layout");
    return { id: game.id, slug: game.slug };
  });
}
