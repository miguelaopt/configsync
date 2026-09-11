import "server-only";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/auth/session";
import { AppError } from "@/lib/data/errors";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const GENERIC_ERROR = "Something went wrong on our side. Your changes are still here — try again.";

/**
 * Runs an authenticated action: validates input, executes, and turns any failure into a
 * message that is safe and useful for the user. Database errors are never forwarded.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  rawInput: unknown,
  fn: (input: z.output<S>, userId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the highlighted fields.",
      fieldErrors,
    };
  }
  try {
    const userId = await requireUserId();
    const data = await fn(parsed.data, userId);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError || error instanceof UnauthorizedError) return error.message;
  // Next.js redirect()/notFound() throw special errors that must propagate.
  if (isNextControlFlow(error)) throw error;
  console.error("[gsv:action]", error);
  return GENERIC_ERROR;
}

function isNextControlFlow(error: unknown) {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}
