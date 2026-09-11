"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Page } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Page>
      <EmptyState
        icon={<TriangleAlert />}
        title="This page hit a snag"
        description="Nothing you saved was lost. Reload to try again — if it keeps happening, check the server log."
        action={
          <>
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>
              Go to dashboard
            </Button>
          </>
        }
      />
      {error.digest ? (
        <p className="mt-4 text-center font-mono text-xs text-ink-3">ref {error.digest}</p>
      ) : null}
    </Page>
  );
}
