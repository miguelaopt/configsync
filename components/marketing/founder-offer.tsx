"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FOUNDER } from "@/lib/billing/public";
import { COOKIE_NOTICE_SEEN, cookieNoticeDismissed } from "./cookie-notice";

const SEEN = "configsync:founder-offer";

/**
 * /pricing already states the offer in the Pro card, and a sales dialog on top of the legal
 * pages reads badly — to a reader and to a payment provider reviewing them.
 */
const QUIET = ["/pricing", "/terms", "/privacy", "/refunds"];

const INCLUDED = ["Unlimited games", "Presets for every PC", "Full settings history"];

/**
 * The alpha founder offer, once per browser.
 *
 * The server decides *whether* it applies (a discount code is configured and the viewer is not
 * already Pro) and only renders this then; the component decides *when* to open. It sends people
 * to /pricing rather than opening a checkout, so every payment still goes through
 * `UpgradeButtons` — the one place that knows how to talk to Paddle — and so that someone who is
 * not signed in lands somewhere that can actually sell to them.
 */
export function FounderOffer({ code }: { code: string }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (QUIET.includes(pathname)) return;
    try {
      if (localStorage.getItem(SEEN)) return;
    } catch {
      return; // blocked storage: we could not remember a dismissal, so never start nagging
    }
    // Two first-visit interruptions at once is one too many: wait out the cookie notice.
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(() => setOpen(true), 6000);
    };
    if (cookieNoticeDismissed()) arm();
    else {
      window.addEventListener(COOKIE_NOTICE_SEEN, arm, { once: true });
      return () => {
        window.removeEventListener(COOKIE_NOTICE_SEEN, arm);
        clearTimeout(timer);
      };
    }
    return () => clearTimeout(timer);
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
        chrome="bare"
        title="Founders get Pro for life"
        description={`The lifetime licence is ${FOUNDER.lifetime} while ConfigSync is in alpha.`}
        className="sm:max-w-[420px]"
      >
        <div className="flex flex-col gap-6 py-1">
          <div>
            <span className="inline-flex rounded-md bg-accent-soft px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent-text uppercase ring-1 ring-accent/30">
              Founders offer
            </span>
            <h2 className="mt-4 text-[27px] leading-[1.15] font-bold tracking-[-0.02em] text-ink">
              Founders get Pro for life.
            </h2>
            <p className="mt-2 text-[15px] text-ink-2">
              One payment. Every game, every PC, forever.
            </p>
          </div>

          <div>
            <p className="flex flex-wrap items-center gap-3">
              <span className="text-[46px] leading-none font-bold tracking-[-0.03em] text-ink">
                {FOUNDER.amount}
              </span>
              <span className="text-[17px] text-ink-3 line-through">{FOUNDER.was}</span>
              <span className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-white">
                {FOUNDER.off}
              </span>
            </p>
            <p className="mt-2 text-[13px] text-ink-3">one-time payment</p>
          </div>

          <ul className="flex flex-col gap-2.5">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[14px] text-ink">
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-accent-soft ring-1 ring-accent/30">
                  <Check className="size-3.5 text-accent-text" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-2 rounded-lg border border-line bg-raised px-3.5 py-3 text-[13px] text-ink-2">
            <Sparkles className="size-4 shrink-0 text-accent-text" aria-hidden />
            <span className="font-mono tracking-[0.06em] text-ink">{code}</span>
            <span>applied automatically</span>
            <Check className="ml-auto size-4 shrink-0 text-good" aria-hidden />
          </p>

          <div className="flex items-center gap-3">
            <Button variant="ghost" className="shrink-0" onClick={close}>
              Maybe later
            </Button>
            <Button asChild variant="primary" size="lg" className="flex-1" onClick={close}>
              <Link href="/pricing#pro">
                Get lifetime Pro — {FOUNDER.amount}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          <p className="text-center text-[12px] text-ink-3">
            VAT included ·{" "}
            <Link href="/refunds" className="text-accent-text hover:text-ink">
              14-day refund guarantee
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
