import { cn } from "@/lib/utils/cn";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-ground px-1 font-sans text-[11px] text-ink-3",
        className,
      )}
      {...props}
    />
  );
}
