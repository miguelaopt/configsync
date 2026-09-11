import { Page } from "@/components/app/page-header";
import { MenuRowsSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Page size="xl">
      <Skeleton className="mb-4 h-3 w-56" />
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
        <div className="hidden flex-col gap-1 lg:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div>
          <Skeleton className="mb-3 h-6 w-32" />
          <MenuRowsSkeleton rows={6} />
          <Skeleton className="mt-8 mb-3 h-6 w-28" />
          <MenuRowsSkeleton rows={4} />
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading preset
      </span>
    </Page>
  );
}
