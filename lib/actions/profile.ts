"use server";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { AppError } from "@/lib/data/errors";
import { preferencesSchema, profileInputSchema } from "@/lib/validation";
import { runAction } from "./shared";

export async function updateProfileAction(input: unknown) {
  return runAction(profileInputSchema, input, async (v, userId) => {
    const clash = await db.query.profiles.findFirst({
      where: and(eq(schema.profiles.username, v.username), ne(schema.profiles.userId, userId)),
    });
    if (clash) throw new AppError("That username is taken.", "conflict");
    await db
      .update(schema.profiles)
      .set({ username: v.username, displayName: v.displayName ?? null })
      .where(eq(schema.profiles.userId, userId));
    if (v.displayName) {
      await db.update(schema.users).set({ name: v.displayName }).where(eq(schema.users.id, userId));
    }
    revalidatePath("/", "layout");
    return null;
  });
}

export async function updatePreferencesAction(input: unknown) {
  return runAction(preferencesSchema, input, async (v, userId) => {
    const current = await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, userId) });
    await db
      .update(schema.profiles)
      .set({ preferences: { ...(current?.preferences ?? {}), ...v } })
      .where(eq(schema.profiles.userId, userId));
    revalidatePath("/", "layout");
    return null;
  });
}
