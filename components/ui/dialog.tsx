"use client";
import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Dialog: centered panel on desktop, bottom sheet on phones so the primary
 * actions stay within thumb reach.
 */
export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col border border-line bg-surface text-ink shadow-dialog outline-none",
          "inset-x-0 bottom-0 rounded-t-lg data-[state=open]:animate-sheet-up",
          "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md sm:data-[state=open]:animate-scale-in",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-md",
          size === "lg" && "sm:max-w-2xl",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 pt-4 pb-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-lg leading-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[13px] text-ink-2">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mt-1 -mr-2">
              <X />
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "safe-bottom -mx-5 mt-4 -mb-4 flex flex-col-reverse gap-2 border-t border-hairline px-5 py-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
