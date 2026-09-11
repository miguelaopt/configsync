"use client";
import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/cn";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-line-strong bg-raised p-0.5 transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-[18px] rounded-full bg-ink-2 transition-transform duration-100 data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-ink" />
    </SwitchPrimitive.Root>
  );
}
