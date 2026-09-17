"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toastError } from "@/components/ui/toaster";
import { saveToVaultAction } from "@/lib/actions/public";

type Props = { username: string; gameSlug: string; presetSlug: string; signedIn: boolean };

/** The acquisition loop: signed out → sign-up and come back; signed in → import into the vault. */
export function SaveToVaultButton({ username, gameSlug, presetSlug, signedIn }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  if (!signedIn) {
    const next = encodeURIComponent(`/p/${username}/${gameSlug}/${presetSlug}`);
    return (
      <Button asChild variant="primary">
        <Link href={`/sign-up?next=${next}`}>Save to my vault</Link>
      </Button>
    );
  }
  return (
    <Button
      variant="primary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await saveToVaultAction({ username, gameSlug, presetSlug });
          if (!r.ok) {
            toastError(r.error);
            return;
          }
          toast.success("Saved to your vault");
          router.push(r.data.url);
        })
      }
    >
      Save to my vault
    </Button>
  );
}
