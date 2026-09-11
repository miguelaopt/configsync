"use client";
import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils/cn";

type Option = { label: string; value: string };

/** Segmented control for short enumerations (Low / Medium / High). */
export function Segmented({
  value,
  onValueChange,
  options,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full rounded-sm border border-line bg-ground p-0.5",
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            "cursor-pointer truncate rounded-xs px-2.5 text-ink-2 transition-colors hover:text-ink data-[state=on]:bg-raised data-[state=on]:text-ink data-[state=on]:shadow-[inset_0_0_0_1px_var(--line-strong)]",
            size === "sm" ? "h-6 text-xs" : "h-7 text-[13px]",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
