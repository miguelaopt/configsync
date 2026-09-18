"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPlan } from "@/lib/billing/plan";
import { createCompanionToken, revokeCompanionToken } from "@/lib/data/companion-tokens";
import { forgetDevice, setDevicePreset } from "@/lib/data/devices";
import { AppError } from "@/lib/data/errors";
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

/** Which preset a PC runs for a game; null = back to the Default. Pro. */
export async function setDevicePresetAction(raw: unknown) {
  return runAction(
    z.object({ deviceId: id, gameId: id, presetId: id.nullable() }),
    raw,
    async (v, userId) => {
      if ((await getPlan(userId)).plan !== "pro")
        throw new AppError(
          "Per-PC presets are a Pro feature — upgrade to Pro to use them.",
          "forbidden",
        );
      await setDevicePreset(userId, v.deviceId, v.gameId, v.presetId);
      revalidatePath("/", "layout");
      return null;
    },
  );
}

export async function forgetDeviceAction(deviceId: string) {
  return runAction(z.object({ deviceId: id }), { deviceId }, async (v, userId) => {
    await forgetDevice(userId, v.deviceId);
    revalidatePath("/", "layout");
    return null;
  });
}
