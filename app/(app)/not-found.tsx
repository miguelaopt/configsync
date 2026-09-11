import Link from "next/link";
import { SearchX } from "lucide-react";
import { Page } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Page>
      <EmptyState
        icon={<SearchX />}
        title="Not found"
        description="That game or preset doesn't exist in your vault. It may have been renamed or deleted."
        action={
          <Button asChild variant="primary">
            <Link href="/games">Back to games</Link>
          </Button>
        }
      />
    </Page>
  );
}
