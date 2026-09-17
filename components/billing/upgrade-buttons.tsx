"use client";
import * as React from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPlanAction } from "@/lib/actions/billing";
import { PADDLE_PUBLIC, PRICES } from "@/lib/billing/public";

type PaddleJs = {
  Environment: { set: (env: "sandbox" | "production") => void };
  Initialize: (o: { token: string; eventCallback?: (e: { name: string }) => void }) => void;
  Checkout: {
    open: (o: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
    }) => void;
  };
};
declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

type Props = { email: string; userId: string; prices: { monthly: string; lifetime: string } };

/** Two Paddle overlay checkouts. After `checkout.completed`, polls the plan until the webhook lands. */
export function UpgradeButtons({ email, userId, prices }: Props) {
  const router = useRouter();
  const [waiting, setWaiting] = React.useState(false);
  const initialised = React.useRef(false);

  /** Paddle.Initialize once, whenever the script is ready — on load or lazily on first click. */
  const init = React.useCallback(() => {
    const P = window.Paddle;
    if (initialised.current || !P || !PADDLE_PUBLIC.token) return;
    initialised.current = true;
    if (PADDLE_PUBLIC.environment === "sandbox") P.Environment.set("sandbox");
    P.Initialize({
      token: PADDLE_PUBLIC.token,
      eventCallback: (e) => {
        if (e.name !== "checkout.completed") return;
        setWaiting(true);
        const started = Date.now();
        const poll = async () => {
          const r = await getPlanAction();
          if (r.ok && r.data.plan === "pro") {
            toast.success("You're on Pro. Thank you!");
            setWaiting(false);
            router.refresh();
            return;
          }
          if (Date.now() - started < 30_000) setTimeout(poll, 2000);
          else {
            setWaiting(false);
            toast(
              "Payment received — Pro activates as soon as Paddle confirms it (a minute at most).",
            );
          }
        };
        void poll();
      },
    });
  }, [router]);

  const open = (priceId: string) => {
    init(); // covers the script already being cached from an earlier page
    if (!window.Paddle) {
      toast("Checkout is still loading — try again in a second.");
      return;
    }
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email },
      customData: { userId },
    });
  };

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={init}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="primary"
          disabled={waiting}
          loading={waiting}
          onClick={() => open(prices.monthly)}
        >
          Go Pro — {PRICES.monthly}
        </Button>
        <Button variant="secondary" disabled={waiting} onClick={() => open(prices.lifetime)}>
          Lifetime — {PRICES.lifetime}
        </Button>
      </div>
    </>
  );
}
