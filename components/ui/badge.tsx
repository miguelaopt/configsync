import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex h-5 items-center gap-1 rounded-xs px-1.5 text-[11px] font-medium leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-raised text-ink-2",
        outline: "border border-line text-ink-2",
        accent: "bg-accent-soft text-accent",
        good: "bg-good-soft text-good",
        bad: "bg-bad-soft text-bad",
        note: "bg-note-soft text-note",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
