"use client";
import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-xs border border-line-strong bg-ground transition-colors disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-accent-ink data-[state=indeterminate]:text-accent">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
