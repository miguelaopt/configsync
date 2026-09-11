"use client";
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/cn";

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-line-strong">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-4 cursor-grab rounded-full border-2 border-accent bg-ground shadow-sm transition-transform hover:scale-110 focus-visible:outline-2 active:cursor-grabbing"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
