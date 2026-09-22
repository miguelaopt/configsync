"use client";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { PADDLE_PUBLIC } from "@/lib/billing/public";
import { PADDLE_JS_SRC } from "@/lib/billing/paddle-js";

/**
 * Makes this page usable as Paddle's default payment link.
 *
 * Paddle builds those links as `<default payment link>?_ptxn=<transaction id>` — it is what an
 * "update your payment method" or past-due email sends people to. Paddle.js opens the checkout
 * for that transaction by itself, but only when it is on the page, and `UpgradeButtons` carries
 * it only for a signed-in Free user: the one visitor who never receives such a link.
 *
 * So: no button and no UI, just Paddle.js, and only when a transaction is actually being paid.
 */
export function PaddlePaymentLink() {
  const paying = useSearchParams().has("_ptxn");
  const token = PADDLE_PUBLIC.token;
  if (!paying || !token) return null;
  return (
    <Script
      src={PADDLE_JS_SRC}
      strategy="afterInteractive"
      onLoad={() => {
        const P = window.Paddle;
        if (!P) return;
        if (PADDLE_PUBLIC.environment === "sandbox") P.Environment.set("sandbox");
        P.Initialize({ token });
      }}
    />
  );
}
