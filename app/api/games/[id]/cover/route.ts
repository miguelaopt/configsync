import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteAttachment, MAX_COVER_BYTES, storeImage } from "@/lib/data/attachments";
import { getGameById, setGameCover } from "@/lib/data/games";
import { AppError } from "@/lib/data/errors";

/** Upload a cover image (raw body, ≤2 MB, PNG/JPEG/WebP/GIF — sniffed, not trusted from headers). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to upload images." }, { status: 401 });
  const { id } = await params;
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_COVER_BYTES) return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 413 });

  try {
    const game = await getGameById(session.user.id, id);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength > MAX_COVER_BYTES) return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 413 });
    const attachmentId = await storeImage(session.user.id, "cover", bytes);
    await setGameCover(session.user.id, game.id, attachmentId);
    if (game.coverAttachmentId) await deleteAttachment(session.user.id, game.coverAttachmentId);
    return NextResponse.json({ ok: true, attachmentId });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[gsv:cover]", error);
    return NextResponse.json({ error: "Couldn't save that image. Try again." }, { status: 500 });
  }
}
