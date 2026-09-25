import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { analyseScreenshots } from "@/lib/data/ai";
import { detectImageType } from "@/lib/data/attachments";
import { AppError } from "@/lib/data/errors";
import type { ScreenshotImage } from "@/lib/providers/screenshot";
import { id } from "@/lib/validation";
import { MAX_SCREENSHOTS } from "@/lib/types";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"] as const;
type Accepted = (typeof ACCEPTED)[number];
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const STATUS = { forbidden: 403, not_found: 404, conflict: 409, invalid: 400 } as const;

/**
 * Analyses the screenshots of one menu against a preset, all in one call: a multipart body with
 * up to MAX_SCREENSHOTS `file` parts, each ≤ 2 MB, type sniffed. Pro only.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("Sign in to import screenshots.", 401);
  const presetId = id.safeParse(new URL(req.url).searchParams.get("preset"));
  if (!presetId.success) return fail("Missing preset.", 400);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_SCREENSHOTS * MAX_BYTES + 64 * 1024)
    return fail("Screenshots must be 2 MB or smaller.", 413);
  try {
    const parts = (await req.formData()).getAll("file");
    if (parts.length === 0) return fail("Add at least one screenshot.", 400);
    if (parts.length > MAX_SCREENSHOTS)
      return fail(`Up to ${MAX_SCREENSHOTS} screenshots at a time.`, 400);
    const images: ScreenshotImage[] = [];
    for (const part of parts) {
      if (typeof part === "string") return fail("Use a PNG, JPEG or WebP screenshot.", 400);
      if (part.size > MAX_BYTES) return fail("Screenshots must be 2 MB or smaller.", 413);
      const bytes = new Uint8Array(await part.arrayBuffer());
      const mimeType = detectImageType(bytes);
      if (!mimeType || !ACCEPTED.includes(mimeType as Accepted))
        return fail("Use a PNG, JPEG or WebP screenshot.", 400);
      images.push({ bytes, mimeType: mimeType as Accepted });
    }
    return NextResponse.json(await analyseScreenshots(session.user.id, presetId.data, images));
  } catch (error) {
    if (error instanceof AppError) return fail(error.message, STATUS[error.code]);
    console.error("[csync:ai]", error);
    return fail("Couldn't analyse those screenshots. Try again.", 500);
  }
}
