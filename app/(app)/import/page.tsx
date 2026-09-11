import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listGames } from "@/lib/data/games";
import { Page, PageHeader } from "@/components/app/page-header";
import { ImportForm } from "@/components/import-export/import-form";
import type { SearchParams } from "@/lib/types";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const games = await listGames(user.id);
  const defaultTarget =
    typeof sp.game === "string" && games.some((g) => g.id === sp.game) ? sp.game : null;
  return (
    <Page size="md">
      <PageHeader
        title="Import"
        description={
          <>
            Bring in a JSON file exported from GameSettings Vault — yours or a friend’s. The format
            is open and documented in{" "}
            <Link
              href={`${SITE.repoUrl}/blob/main/${SITE.docsImportExport}`}
              className="text-ink underline underline-offset-4"
            >
              docs/import-export.md
            </Link>
            .
          </>
        }
      />
      <ImportForm
        games={games.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))}
        defaultTargetId={defaultTarget}
      />
    </Page>
  );
}
