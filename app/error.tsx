"use client";
import { useEffect } from "react";
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
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-[13px] text-ink-2">
        Nothing you saved was lost. Try again, or reload the page.
      </p>
      <Button variant="primary" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
