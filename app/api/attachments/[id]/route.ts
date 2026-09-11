import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAttachment } from "@/lib/data/attachments";
import { AppError } from "@/lib/data/errors";

/** Serves a user's own uploaded image. Cached privately; ids are random UUIDs. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  try {
    const file = await getAttachment(session.user.id, id);
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.byteSize),
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof AppError) return new NextResponse(null, { status: 404 });
    throw error;
  }
}
