import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { analyseScreenshot } from "@/lib/data/ai";
import { detectImageType } from "@/lib/data/attachments";
import { AppError } from "@/lib/data/errors";
import { id } from "@/lib/validation";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"] as const;
type Accepted = (typeof ACCEPTED)[number];
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const STATUS = { forbidden: 403, not_found: 404, conflict: 409, invalid: 400 } as const;

/** Analyse one screenshot against a preset: raw image body ≤ 2 MB, type sniffed. Pro only. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("Sign in to import screenshots.", 401);
  const presetId = id.safeParse(new URL(req.url).searchParams.get("preset"));
  if (!presetId.success) return fail("Missing preset.", 400);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES)
    return fail("Screenshots must be 2 MB or smaller.", 413);
  try {
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return fail("Screenshots must be 2 MB or smaller.", 413);
    const mimeType = detectImageType(bytes);
    if (!mimeType || !ACCEPTED.includes(mimeType as Accepted))
      return fail("Use a PNG, JPEG or WebP screenshot.", 400);
    const result = await analyseScreenshot(session.user.id, presetId.data, {
      bytes,
      mimeType: mimeType as Accepted,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) return fail(error.message, STATUS[error.code]);
    console.error("[csync:ai]", error);
    return fail("Couldn't analyse that screenshot. Try again.", 500);
  }
}
