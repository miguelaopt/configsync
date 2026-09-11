"use client";
import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/cn";
import { Button, type ButtonProps } from "./button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm: () => unknown;
  loading?: boolean;
};

/** Confirmation for destructive actions. Focus lands on Cancel by default. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed z-50 w-full border border-line bg-surface p-5 text-ink shadow-dialog outline-none",
            "inset-x-0 bottom-0 rounded-t-lg data-[state=open]:animate-sheet-up",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-md sm:data-[state=open]:animate-scale-in",
          )}
        >
          <AlertDialogPrimitive.Title className="font-display text-lg">
            {title}
          </AlertDialogPrimitive.Title>
          {description ? (
            <AlertDialogPrimitive.Description className="mt-2 text-[13px] leading-relaxed text-ink-2">
              {description}
            </AlertDialogPrimitive.Description>
          ) : null}
          <div className="safe-bottom mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                variant={confirmVariant}
                loading={loading}
                onClick={(e) => {
                  e.preventDefault();
                  void Promise.resolve(onConfirm()).then(() => onOpenChange(false));
                }}
              >
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
