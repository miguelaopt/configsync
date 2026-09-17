import { createHash, randomBytes } from "node:crypto";

/** Pure token helpers, importable by tests and by lib/data. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateToken() {
  const token = `csync_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token) };
}
