import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const inputClass =
  "h-9 w-full min-w-0 rounded-sm border border-line bg-ground px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-accent focus:outline-none aria-invalid:border-bad disabled:opacity-50";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputClass, "h-auto min-h-20 resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  );
}
