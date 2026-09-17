import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/data/errors";

const base =
  process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";

const PORTAL_ERROR = "Couldn't open the billing portal right now. Try again in a minute.";

/** Authenticated link to Paddle's customer portal (manage/cancel subscription, invoices). */
export async function createPortalSession(customerId: string): Promise<string> {
  const res = await fetch(`${base}/customers/${customerId}/portal-sessions`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.PADDLE_API_KEY}`, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error("[csync:billing] portal session failed", res.status);
    throw new AppError(PORTAL_ERROR);
  }
  const json = (await res.json()) as { data?: { urls?: { general?: { overview?: string } } } };
  const url = json.data?.urls?.general?.overview;
  if (!url) throw new AppError(PORTAL_ERROR);
  return url;
}
