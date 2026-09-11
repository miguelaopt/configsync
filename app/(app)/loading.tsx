import { Page } from "@/components/app/page-header";
import { MenuRowsSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Page size="xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <MenuRowsSkeleton rows={7} />
      <span className="sr-only" role="status">
        Loading
      </span>
    </Page>
  );
}
