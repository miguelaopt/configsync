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
    <Page size="lg">
      <PageHeader
        title="Import"
        description="Bring settings into your vault from a ConfigSync backup or a game's own config files."
      />
      <p className="mb-5 text-[13px] text-ink-3">
        Your files stay yours. Review everything before it is added to your vault.
      </p>
      <Tabs defaultValue={sp.tab === "files" ? "files" : "json"}>
        <TabsList className="mb-5">
          <TabsTrigger value="json">ConfigSync backup</TabsTrigger>
          <TabsTrigger value="files">Game config</TabsTrigger>
        </TabsList>
        <TabsContent value="json">
          <h2 className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            Import from ConfigSync
          </h2>
          <p className="mb-5 text-[13px] text-ink-2">
            Move presets from another account, another device, or a backup.
          </p>
          <ImportForm
            games={games.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))}
            defaultTargetId={defaultTarget}
          />
        </TabsContent>
        <TabsContent value="files">
          <h2 className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
            Game config
          </h2>
          <p className="mb-5 text-[13px] text-ink-2">
            Read settings straight out of a game&rsquo;s own configuration files.
          </p>
          <GameFilesForm catalog={publicCatalog()} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
