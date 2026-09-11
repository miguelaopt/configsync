import { cn } from "@/lib/utils/cn";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div aria-hidden className={cn("animate-pulse rounded-sm bg-raised", className)} {...props} />
  );
}

/** Skeleton shaped like a settings menu — used by preset editor loading states. */
export function MenuRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-hairline">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-row items-center justify-between px-3">
          <Skeleton className="h-3.5 w-40" style={{ width: `${30 + ((i * 17) % 40)}%` }} />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}
