"use client";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Backdrop, MarketingHeader } from "@/components/marketing/chrome";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-ground">
      <Backdrop />
      <MarketingHeader />
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-text"
        >
          <TriangleAlert className="size-7" />
        </span>
        <h1 className="mt-5 text-[28px] font-bold tracking-[-0.02em]">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-[15px] text-ink-2">
          Nothing you saved was lost. Try again, or reload the page.
        </p>
        <Button variant="primary" size="lg" className="mt-8" onClick={reset}>
          Try again
        </Button>
        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-ink-3">ref {error.digest}</p>
        ) : null}
      </main>
    </div>
  );
}
