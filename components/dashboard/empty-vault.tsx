import Link from "next/link";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { NewGameButton } from "@/components/games/new-game-button";
import type { PublicCatalogEntry } from "@/lib/catalog";

const STEPS = [
  { title: "Add a game", body: "Choose a supported game, or add any game yourself." },
  { title: "Create a preset", body: "Save the setup you use for each situation." },
  { title: "Keep it synced", body: "Run the companion and use the same setup on every PC." },
];

/**
 * The first thing a new account sees. One compact column, no box around it — the page is not
 * missing a panel, it is waiting for a game.
 */
export function EmptyVault({ catalog, owned }: { catalog: PublicCatalogEntry[]; owned: string[] }) {
  const names = catalog.slice(0, 2).map((c) => c.name);
  return (
    <div className="flex flex-col items-center py-10 sm:py-16">
      <div className="flex w-full max-w-[560px] flex-col items-center text-center">
        <LogoMark size={44} />
        <h2 className="mt-5 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
          Build your library
        </h2>
        <p className="mt-2.5 text-[15px] text-ink-2">
          Add your first game, create a preset, and keep your settings ready everywhere.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <NewGameButton size="lg" catalog={catalog} owned={owned} />
          <Button asChild variant="ghost" size="sm">
            <Link href="/import">Import config</Link>
          </Button>
        </div>
        {names.length > 0 ? (
          <p className="mt-5 text-[13px] text-ink-3">
            {names.join(" and ")} supported — any other game works too.
          </p>
        ) : null}
      </div>

      <ul className="mt-14 grid w-full max-w-3xl gap-8 text-left sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.title}>
            <h3 className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
              {s.title}
            </h3>
            <p className="mt-1.5 text-[13px] text-ink-2">{s.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
