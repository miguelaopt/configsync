"use client";
import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/cn";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("no-scrollbar flex gap-1 overflow-x-auto border-b border-line", className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px h-10 shrink-0 cursor-pointer border-b-2 border-transparent px-3 text-sm text-ink-2 transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}
