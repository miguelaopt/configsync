"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeOff } from "lucide-react";
import { hidePresetAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";

/** Moderation: takes a public preset off its owner's public profile. */
export function HidePresetButton({ presetId, name }: { presetId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={`Make ${name} private`}
      >
        <EyeOff /> Make private
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Make “${name}” private?`}
        description="It disappears from the owner's public profile. They can publish it again."
        confirmLabel="Make private"
        loading={pending}
        onConfirm={() =>
          new Promise<void>((resolve) =>
            start(async () => {
              const r = await hidePresetAction({ presetId });
              if (r.ok) {
                toast.success("Preset made private");
                router.refresh();
              } else toast.error(r.error);
              resolve();
            }),
          )
        }
      />
    </>
  );
}
