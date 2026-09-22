"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { FOUNDER, PRICES } from "@/lib/billing/public";

const SEEN = "configsync:founder-offer";

/**
 * /pricing already states the offer in the Pro card, and a sales dialog on top of the legal
 * pages reads badly — to a reader and to a payment provider reviewing them.
 */
const QUIET = ["/pricing", "/terms", "/privacy", "/refunds"];

/** Copy to clipboard, reporting whether it worked — it throws on an insecure origin. */
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CodeRow({ code }: { code: string }) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");
  React.useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div>
      {/* The code reads as what it is: a value to copy, set like the config lines the product
          is built around, rather than as e-commerce chrome. */}
      <div className="flex items-center gap-3 rounded-lg border border-accent/35 bg-raised px-4 py-3">
        <code className="min-w-0 flex-1 truncate font-mono text-[18px] tracking-[0.08em] text-ink">
          {code}
        </code>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={async () => setState((await copy(code)) ? "copied" : "failed")}
        >
          {state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
          {state === "copied" ? "Copied" : "Copy"}
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 text-[13px] text-ink-3">
        {state === "failed"
          ? "Copying was blocked — select the code and copy it by hand."
          : "Use it at checkout. Opening Pro from here fills it in for you."}
      </p>
    </div>
  );
}

/**
 * The alpha founder offer, once per browser.
 *
 * The server decides *whether* it applies (a discount code is configured and the viewer is not
 * already Pro) and only renders this then; the component decides *when* to open. It hands over
 * the code and sends people to /pricing rather than opening a checkout, so every payment still
 * goes through `UpgradeButtons` — one place that knows how to talk to Paddle.
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
        description="The lifetime licence is discounted while ConfigSync is in alpha."
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="flex items-baseline gap-3">
              <span className="text-[40px] leading-none font-bold tracking-[-0.02em] text-ink">
                {FOUNDER.lifetime}
              </span>
              <span className="text-[16px] text-ink-3 line-through">{FOUNDER.was}</span>
            </p>
            <p className="mt-2 text-[14px] text-ink-2">
              Pro on every PC you play on, paid once, for as long as this service runs: unlimited
              games, the full history of every change, and a preset per machine.
            </p>
          </div>

          <CodeRow code={code} />

          <p className="text-[12px] text-ink-3">
            VAT included.{" "}
            <Link href="/refunds" className="text-accent-text hover:text-ink">
              14-day refund
            </Link>{" "}
            on every payment, no reason needed. Monthly stays {PRICES.monthly}.
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
