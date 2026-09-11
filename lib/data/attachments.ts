import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { AppError, notFound } from "./errors";

const { attachments } = schema;

export const MAX_COVER_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Sniffs magic bytes so a renamed .exe can't be stored as an "image". */
export function detectImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  if (
    b.length > 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

export async function storeImage(userId: string, kind: "cover" | "screenshot", bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw new AppError("The file is empty.");
  if (bytes.byteLength > MAX_COVER_BYTES) throw new AppError("Images must be 2 MB or smaller.");
  const mimeType = detectImageType(bytes);
  if (!mimeType || !ALLOWED.has(mimeType))
    throw new AppError("Use a PNG, JPEG, WebP or GIF image.");
  const [row] = await db
    .insert(attachments)
    .values({ userId, kind, mimeType, byteSize: bytes.byteLength, data: Buffer.from(bytes) })
    .returning({ id: attachments.id });
  return row!.id;
}

export async function getAttachment(userId: string, id: string) {
  const row = await db.query.attachments.findFirst({
    where: and(eq(attachments.userId, userId), eq(attachments.id, id)),
  });
  if (!row) throw notFound("image");
  return row;
}

export async function deleteAttachment(userId: string, id: string) {
  await db.delete(attachments).where(and(eq(attachments.userId, userId), eq(attachments.id, id)));
}
