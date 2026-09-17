"use server";
import { z } from "zod";
import { getPlan } from "@/lib/billing/plan";
import { createPortalSession } from "@/lib/billing/paddle-api";
import { AppError } from "@/lib/data/errors";
import { runAction } from "./shared";

export async function getPlanAction() {
  return runAction(z.null(), null, (_v, userId) => getPlan(userId));
}

export async function portalSessionAction() {
  return runAction(z.null(), null, async (_v, userId) => {
    const { paddleCustomerId } = await getPlan(userId);
    if (!paddleCustomerId) throw new AppError("There's no subscription to manage on this account.");
    return { url: await createPortalSession(paddleCustomerId) };
  });
}
