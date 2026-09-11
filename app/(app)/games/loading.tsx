import { Page } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Page size="xl">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="mb-6 h-9 w-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="mt-2 h-3.5 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-1/2" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading games
      </span>
    </Page>
  );
}
