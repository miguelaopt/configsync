"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCompanionToken, revokeCompanionToken } from "@/lib/data/companion-tokens";
import { id } from "@/lib/validation";
import { runAction } from "./shared";

export async function createCompanionTokenAction(name: string) {
  return runAction(
    z.object({ name: z.string().trim().min(1, "Give the token a name.").max(60) }),
    { name },
    async (v, userId) => {
      const t = await createCompanionToken(userId, v.name);
      revalidatePath("/settings");
      return { token: t.token };
    },
  );
}

export async function revokeCompanionTokenAction(tokenId: string) {
  return runAction(z.object({ tokenId: id }), { tokenId }, async (v, userId) => {
    await revokeCompanionToken(userId, v.tokenId);
    revalidatePath("/settings");
    return null;
  });
}
