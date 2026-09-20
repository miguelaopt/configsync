import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listGames } from "@/lib/data/games";
import { publicCatalog } from "@/lib/catalog";
import { FileJson, FolderCog } from "lucide-react";
import { Page, PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/dashboard/panels";
import { ImportForm } from "@/components/import-export/import-form";
import { GameFilesForm } from "@/components/import-export/game-files-form";
import { RecentImports } from "@/components/import-export/recent-imports";
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
    <Page size="xl">
      <PageHeader
        title="Import"
        description="Bring settings into your vault from a ConfigSync backup or a game's own config files. Your files stay yours — review everything before it is added."
      />
      <Tabs defaultValue={sp.tab === "files" ? "files" : "json"}>
        <TabsList className="mb-5">
          <TabsTrigger value="json">ConfigSync backup</TabsTrigger>
          <TabsTrigger value="files">Game config</TabsTrigger>
        </TabsList>
        <TabsContent value="json">
          <Panel
            icon={<FileJson />}
            title="Import from ConfigSync"
            subtitle="Move presets from another account, another device, or a backup."
          >
            <ImportForm
              userId={user.id}
              games={games.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))}
              defaultTargetId={defaultTarget}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="files">
          <Panel
            icon={<FolderCog />}
            title="Game config"
            subtitle="Read settings straight out of a game's own configuration files."
          >
            <GameFilesForm catalog={publicCatalog()} userId={user.id} />
          </Panel>
        </TabsContent>
      </Tabs>
      <RecentImports userId={user.id} />
    </Page>
  );
}
