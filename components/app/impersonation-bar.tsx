"use client";
import * as React from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stopImpersonatingAction } from "@/lib/actions/admin";

/** Shown on every page while an admin views the app as someone else. */
export function ImpersonationBar({ name, email }: { name: string; email: string }) {
  const [pending, start] = React.useTransition();
  return (
    <div
      role="status"
      className="sticky top-16 z-30 flex flex-wrap items-center gap-3 border-b border-note/40 bg-note-soft px-4 py-2 text-[13px] text-ink sm:px-6"
    >
      <Eye className="size-4 shrink-0 text-note" aria-hidden />
      <span className="min-w-0 flex-1">
        Viewing ConfigSync as <strong>{name}</strong> ({email}). Everything you do is done as them.
      </span>
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() => start(() => stopImpersonatingAction())}
      >
        Stop viewing
      </Button>
    </div>
  );
}
