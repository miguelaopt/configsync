"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { getSession, UnauthorizedError } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { AppError } from "@/lib/data/errors";
import { getPlanRow, upsertPlanRow } from "@/lib/data/billing";
import { recordAudit } from "@/lib/data/admin";
import { resolvePlan } from "@/lib/billing/paddle";
import { sendEmail } from "@/lib/email";
import { toUserMessage, type ActionResult } from "./shared";

const { users, sessions, companionTokens, plans, presets } = schema;
const userId = z.string().min(1).max(64);

/**
 * Like runAction, but for /admin: the caller must be an admin, the target is loaded (and never
 * another admin unless `allowAdminTarget`), and every success is written to the audit log.
 */
async function adminAction<S extends z.ZodType>(
  action: string,
  schemaIn: S,
  raw: unknown,
  fn: (
    input: z.output<S>,
    ctx: { actorId: string; target: typeof users.$inferSelect | null },
  ) => Promise<Record<string, unknown> | void>,
): Promise<ActionResult> {
  const parsed = schemaIn.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const session = await getSession();
    if (session?.user.role !== "admin") throw new UnauthorizedError("Admins only.");
    const input = parsed.data as z.output<S> & { userId?: string };
    const target = input.userId
      ? ((await db.query.users.findFirst({ where: eq(users.id, input.userId) })) ?? null)
      : null;
    if (input.userId && !target) throw new AppError("That account no longer exists.");
    const details = await fn(input, { actorId: session.user.id, target });
    await recordAudit({
      actorId: session.user.id,
      action,
      targetUserId: target?.id ?? null,
      details: { ...(target ? { email: target.email } : {}), ...(details ?? {}) },
    });
    revalidatePath("/admin", "layout");
    return { ok: true, data: null };
  } catch (error) {
    if (isAPIError(error)) return { ok: false, error: error.message };
    return { ok: false, error: toUserMessage(error) };
  }
}

const notAdmin = (t: { role: string | null } | null) => {
  if (t?.role === "admin") throw new AppError("Not on another admin.");
};

// Plan -------------------------------------------------------------------------------------------

export async function grantProAction(input: unknown) {
  return adminAction(
    "grant_pro",
    z.object({ userId, note: z.string().max(200).default("") }),
    input,
    async (v) => {
      const current = await getPlanRow(v.userId);
      if (current && resolvePlan(current) === "pro")
        throw new AppError(
          current.source === "manual" ? "Already Pro (granted)." : "Already Pro through Paddle.",
        );
      await upsertPlanRow({
        userId: v.userId,
        source: "manual",
        paddleCustomerId: current?.paddleCustomerId ?? null,
        paddleSubscriptionId: current?.paddleSubscriptionId ?? null,
        subscriptionStatus: current?.subscriptionStatus ?? null,
        currentPeriodEnd: current?.currentPeriodEnd ?? null,
      });
      return { note: v.note };
    },
  );
}

/** Only a granted Pro can be taken back here; paid plans are Paddle's (cancel or refund there). */
export async function revokeProAction(input: unknown) {
  return adminAction("revoke_pro", z.object({ userId }), input, async (v) => {
    const current = await getPlanRow(v.userId);
    if (current?.source !== "manual") throw new AppError("Only a granted Pro can be revoked here.");
    if (current.paddleCustomerId || current.paddleSubscriptionId)
      await upsertPlanRow({
        ...current,
        source: "subscription",
        subscriptionStatus: "canceled",
        currentPeriodEnd: null,
      });
    else await db.delete(plans).where(eq(plans.userId, v.userId));
  });
}

// Access -----------------------------------------------------------------------------------------

export async function revokeSessionsAction(input: unknown) {
  return adminAction("revoke_sessions", z.object({ userId }), input, async (v, { target }) => {
    notAdmin(target);
    const gone = await db
      .delete(sessions)
      .where(eq(sessions.userId, v.userId))
      .returning({ id: sessions.id });
    return { sessions: gone.length };
  });
}

export async function revokeTokensAction(input: unknown) {
  return adminAction("revoke_companion_tokens", z.object({ userId }), input, async (v) => {
    const gone = await db
      .delete(companionTokens)
      .where(eq(companionTokens.userId, v.userId))
      .returning({ id: companionTokens.id });
    return { tokens: gone.length };
  });
}

/** Ban: no sign-in, every session and companion token gone. `days` null = until lifted. */
export async function banAction(input: unknown) {
  return adminAction(
    "ban",
    z.object({
      userId,
      reason: z.string().trim().min(1, "Give a reason.").max(300),
      days: z.number().int().min(1).max(3650).nullable(),
    }),
    input,
    async (v, { target }) => {
      notAdmin(target);
      await auth.api.banUser({
        headers: await headers(),
        body: {
          userId: v.userId,
          banReason: v.reason,
          banExpiresIn: v.days ? v.days * 86_400 : undefined,
        },
      });
      await db.delete(companionTokens).where(eq(companionTokens.userId, v.userId));
      return { reason: v.reason, days: v.days };
    },
  );
}

export async function unbanAction(input: unknown) {
  return adminAction("unban", z.object({ userId }), input, async (v) => {
    await auth.api.unbanUser({ headers: await headers(), body: { userId: v.userId } });
  });
}

export async function verifyEmailAction(input: unknown) {
  return adminAction("verify_email", z.object({ userId }), input, async (v) => {
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, v.userId));
  });
}

/**
 * Deletes the account and everything it owns (cascades). Refused while a paid subscription is
 * live: Paddle would keep charging an account that no longer exists.
 */
export async function deleteUserAction(input: unknown) {
  return adminAction(
    "delete_user",
    z.object({ userId, confirmEmail: z.string().trim() }),
    input,
    async (v, { target, actorId }) => {
      notAdmin(target);
      if (v.userId === actorId) throw new AppError("Not your own account.");
      if (target!.email.toLowerCase() !== v.confirmEmail.toLowerCase())
        throw new AppError("Type the account's email to confirm.");
      const plan = await getPlanRow(v.userId);
      if (
        plan?.source === "subscription" &&
        resolvePlan(plan) === "pro" &&
        plan.subscriptionStatus !== "canceled"
      )
        throw new AppError("Cancel the subscription in Paddle first.");
      await db.delete(users).where(eq(users.id, v.userId));
      return { name: target!.name };
    },
  );
}

// View as ----------------------------------------------------------------------------------------

/** Opens the app as this user for an hour. The bar at the top of every page stops it. */
export async function impersonateAction(input: unknown) {
  const result = await adminAction(
    "impersonate",
    z.object({ userId }),
    input,
    async (v, { target }) => {
      notAdmin(target);
      await auth.api.impersonateUser({ headers: await headers(), body: { userId: v.userId } });
    },
  );
  if (result.ok) redirect("/dashboard");
  return result;
}

/** Called from the impersonation bar, where the session belongs to the viewed user. */
export async function stopImpersonatingAction() {
  const session = await getSession();
  const adminId = session?.session.impersonatedBy;
  if (!session || !adminId) redirect("/dashboard");
  await auth.api.stopImpersonating({ headers: await headers() });
  await recordAudit({
    actorId: adminId,
    action: "stop_impersonating",
    targetUserId: session.user.id,
    details: { email: session.user.email },
  });
  redirect(`/admin/users/${session.user.id}`);
}

// Communication and moderation -------------------------------------------------------------------

export async function emailUserAction(input: unknown) {
  return adminAction(
    "email_user",
    z.object({
      userId,
      subject: z.string().trim().min(1, "Add a subject.").max(150),
      body: z.string().trim().min(1, "Write something.").max(5000),
    }),
    input,
    async (v, { target }) => {
      await sendEmail({ to: target!.email, subject: v.subject, text: v.body });
      return { subject: v.subject };
    },
  );
}

export async function hidePresetAction(input: unknown) {
  return adminAction("hide_preset", z.object({ presetId: z.uuid() }), input, async (v) => {
    const [row] = await db
      .update(presets)
      .set({ visibility: "private" })
      .where(eq(presets.id, v.presetId))
      .returning({ name: presets.name });
    if (!row) throw new AppError("That preset no longer exists.");
    return { presetId: v.presetId, preset: row.name };
  });
}
