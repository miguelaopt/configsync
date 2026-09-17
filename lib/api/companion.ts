import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireCompanionUser } from "@/lib/auth/companion";
import { UnauthorizedError } from "@/lib/auth/session";
import { AppError } from "@/lib/data/errors";

/** Auth + validate + map errors, so each companion route is just its body. */
export function companionRoute<S extends z.ZodType | null, T>(
  schema: S,
  fn: (input: S extends z.ZodType ? z.output<S> : null, userId: string, req: Request) => Promise<T>,
) {
  return async (req: Request) => {
    try {
      const userId = await requireCompanionUser(req);
      let input: unknown = null;
      if (schema) {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
          const i = parsed.error.issues[0];
          return NextResponse.json(
            { error: `${i?.path.join(".") || "body"}: ${i?.message}` },
            { status: 400 },
          );
        }
        input = parsed.data;
      }
      return NextResponse.json(await fn(input as never, userId, req));
    } catch (error) {
      if (error instanceof UnauthorizedError)
        return NextResponse.json({ error: error.message }, { status: 401 });
      if (error instanceof AppError)
        return NextResponse.json({ error: error.message }, { status: 404 });
      console.error("[gsv:companion]", error);
      return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
    }
  };
}
