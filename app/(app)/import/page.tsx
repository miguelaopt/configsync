import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listGames } from "@/lib/data/games";
import { publicCatalog } from "@/lib/catalog";
import { Page, PageHeader } from "@/components/app/page-header";
import { ImportForm } from "@/components/import-export/import-form";
import { GameFilesForm } from "@/components/import-export/game-files-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SearchParams } from "@/lib/types";

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
            Bring in a JSON file exported from ConfigSync — yours or a friend’s — or read a game’s
            own config files.
          </>
        }
      />
      <Tabs defaultValue={sp.tab === "files" ? "files" : "json"}>
        <TabsList className="mb-5">
          <TabsTrigger value="json">Vault JSON</TabsTrigger>
          <TabsTrigger value="files">Game files</TabsTrigger>
        </TabsList>
        <TabsContent value="json">
          <ImportForm
            games={games.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))}
            defaultTargetId={defaultTarget}
          />
        </TabsContent>
        <TabsContent value="files">
          <GameFilesForm catalog={publicCatalog()} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
