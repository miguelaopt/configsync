import type { Metadata } from "next";
import { Gamepad2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listGames } from "@/lib/data/games";
import { Page, PageHeader } from "@/components/app/page-header";
import { GameGrid } from "@/components/games/game-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { LibraryToolbar } from "@/components/games/library-toolbar";
import { NewGameButton } from "@/components/games/new-game-button";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Games" };

export default async function GamesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const archived = params.view === "archived";
  const openNew = params.new === "1";
  const games = await listGames(user.id, { archived, query: q });

  return (
    <Page size="xl">
      <PageHeader
        title={archived ? "Archived games" : "Games"}
        description={archived ? "Archived games stay searchable and exportable." : undefined}
        actions={<NewGameButton autoOpen={openNew} />}
      >
        <LibraryToolbar query={q} archived={archived} />
      </PageHeader>

      {games.length === 0 ? (
        q ? (
          <EmptyState
            icon={<Gamepad2 />}
            title={`No games match “${q}”`}
            description="Try a different name, platform or tag."
            action={
              <Button asChild variant="secondary">
                <Link href={archived ? "/games?view=archived" : "/games"}>Clear search</Link>
              </Button>
            }
          />
        ) : archived ? (
          <EmptyState
            icon={<Gamepad2 />}
            title="Nothing archived"
            description="Archive a game from its menu to tuck it away without deleting anything."
          />
        ) : (
          <EmptyState
            icon={<Gamepad2 />}
            title="Add your first game"
            description="Any game works — you name it, add presets, and build categories that mirror the game's own menu."
            action={
              <>
                <NewGameButton variant="primary" />
                <Button asChild variant="secondary">
                  <Link href="/import">Import a file</Link>
                </Button>
              </>
            }
          />
        )
      ) : (
        <GameGrid games={games} />
      )}
    </Page>
  );
}
