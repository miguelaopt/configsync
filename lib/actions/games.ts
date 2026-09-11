"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as data from "@/lib/data/games";
import { deleteAttachment } from "@/lib/data/attachments";
import { gameInputSchema, id } from "@/lib/validation";
import { runAction } from "./shared";

export async function createGameAction(input: unknown) {
  return runAction(gameInputSchema, input, async (values, userId) => {
    const game = await data.createGame(userId, values);
    revalidatePath("/games");
    revalidatePath("/dashboard");
    return { id: game.id, slug: game.slug };
  });
}

export async function updateGameAction(gameId: string, input: unknown) {
  return runAction(gameInputSchema, input, async (values, userId) => {
    const game = await data.updateGame(userId, gameId, values);
    revalidatePath("/games");
    revalidatePath(`/games/${game.slug}`);
    return { id: game.id, slug: game.slug };
  });
}

const flagSchema = z.object({ gameId: id, value: z.boolean() });

export async function setGameFavoriteAction(gameId: string, value: boolean) {
  return runAction(flagSchema, { gameId, value }, async (v, userId) => {
    await data.setGameFlags(userId, v.gameId, { isFavorite: v.value });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function setGameArchivedAction(gameId: string, value: boolean) {
  return runAction(flagSchema, { gameId, value }, async (v, userId) => {
    await data.setGameFlags(userId, v.gameId, { isArchived: v.value });
    revalidatePath("/", "layout");
    return null;
  });
}

export async function deleteGameAction(gameId: string) {
  return runAction(z.object({ gameId: id }), { gameId }, async (v, userId) => {
    await data.deleteGame(userId, v.gameId);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function removeGameCoverAction(gameId: string) {
  return runAction(z.object({ gameId: id }), { gameId }, async (v, userId) => {
    const game = await data.getGameById(userId, v.gameId);
    if (game.coverAttachmentId) await deleteAttachment(userId, game.coverAttachmentId);
    await data.setGameCover(userId, v.gameId, null);
    revalidatePath("/", "layout");
    return null;
  });
}
