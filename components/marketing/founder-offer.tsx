"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { FOUNDER, PRICES } from "@/lib/billing/public";

const SEEN = "configsync:founder-offer";

/**
 * /pricing already states the offer in the Pro card, and a sales dialog on top of the legal
 * pages reads badly — to a reader and to a payment provider reviewing them.
 */
const QUIET = ["/pricing", "/terms", "/privacy", "/refunds"];

/**
 * The alpha founder offer on the lifetime licence, once per browser.
 *
 * The server decides *whether* it applies (the Paddle discount is configured and the viewer is
 * not already Pro) and only renders this then; the component decides *when* to open. It sends
 * people to /pricing rather than opening a checkout, so every payment still goes through
 * `UpgradeButtons` — one place that knows how to talk to Paddle.
 */
export function FounderOffer() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (QUIET.includes(pathname)) return;
    try {
      if (localStorage.getItem(SEEN)) return;
    } catch {
      return; // blocked storage: we could not remember a dismissal, so never start nagging
    }
    const t = setTimeout(() => setOpen(true), 6000);
    return () => clearTimeout(t);
  }, [pathname]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      // nothing to do: worst case it is offered again on the next visit
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent
        title="Alpha founder offer"
        description="ConfigSync is in alpha, and the lifetime licence is discounted while it is."
      >
        <div className="flex flex-col gap-4">
          <p className="flex items-baseline gap-2.5">
            <span className="text-[34px] leading-none font-bold text-ink">{FOUNDER.lifetime}</span>
            <span className="text-[15px] text-ink-3 line-through">{FOUNDER.was}</span>
          </p>
          <p className="text-[14px] text-ink-2">
            Pro, paid once, for as long as this hosted service runs: unlimited games, the full
            history of every change you make, auto-switch, and a different preset on each PC.
          </p>
          <p className="text-[13px] text-ink-3">
            Prefer not to pay up front? Pro is also {PRICES.monthly}, at the normal price.
          </p>
          <p className="text-[12px] text-ink-3">
            VAT included.{" "}
            <Link href="/refunds" className="text-accent-text hover:text-ink">
              14-day refund
            </Link>{" "}
            on every payment, no reason needed.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Not now
          </Button>
          <Button asChild variant="primary" onClick={close}>
            <Link href="/pricing#pro">See what Pro includes</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
