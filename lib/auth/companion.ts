import "server-only";
import { UnauthorizedError } from "@/lib/auth/session";
import { userIdForToken } from "@/lib/data/companion-tokens";

/** `Authorization: Bearer gsv_…` → user id. Fails closed. */
export async function requireCompanionUser(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const userId = token ? await userIdForToken(token) : null;
  if (!userId)
    throw new UnauthorizedError("Invalid or revoked companion token. Run `gsv login` again.");
  return userId;
}
