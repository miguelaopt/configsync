import Link from "next/link";
import { Check, Gamepad2, ListChecks, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewGameButton } from "@/components/games/new-game-button";
import { CatalogPicker } from "@/components/games/catalog-picker";
import { Panel } from "@/components/dashboard/panels";
import { WindowsAppCard } from "@/components/app/windows-app";
import type { PublicCatalogEntry } from "@/lib/catalog";
import { cn } from "@/lib/utils/cn";

/**
 * The first dashboard of a new account, in the same main column + rail as every other screen:
 * the supported games one click away, the three steps with what is already done, and the
 * Windows app where the dashboard always keeps it.
 */
export function EmptyVault({
  catalog,
  owned,
  pcConnected,
  rail,
}: {
  catalog: PublicCatalogEntry[];
  owned: string[];
  /** A PC with the companion has reported in, even before any game exists. */
  pcConnected: boolean;
  /** Extra rail panels (the Pro offer). */
  rail?: React.ReactNode;
}) {
  const steps = [
    {
      title: "Add a game",
      body: "Pick a supported game above, or add any other game by name.",
      done: false,
    },
    {
      title: "Save your settings",
      body: "Set each value the way you play and save. That is a preset: make one per setup, like LAN, stream or laptop.",
      done: false,
    },
    {
      title: "Connect your PC",
      body: "The app writes the preset into the game's own files, with a backup first and never while the game runs.",
      done: pcConnected,
      href: { href: "/docs/companion", label: "How it works" },
    },
  ];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Panel
          icon={<Gamepad2 />}
          title="Start with a supported game"
          subtitle="It comes with the game's real settings menu, named as in the game. You fill in your values."
        >
          <CatalogPicker entries={catalog} owned={owned} />
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="mr-1 text-[13px] text-ink-3">Playing something else?</span>
            <NewGameButton variant="secondary" catalog={catalog} owned={owned} />
            <Button asChild variant="ghost">
              <Link href="/import">
                <Upload /> Import a config file
              </Link>
            </Button>
          </div>
        </Panel>

        <Panel
          icon={<ListChecks />}
          title="Getting started"
          subtitle="Three steps to the same setup on every PC"
        >
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="flex gap-3 border-b border-line py-3 last:border-0 last:pb-0"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                    s.done ? "bg-good-soft text-good" : "bg-raised text-ink-2",
                  )}
                  aria-hidden
                >
                  {s.done ? <Check className="size-4" /> : i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-medium text-ink">
                    {s.title}
                    {s.done ? <span className="sr-only"> (done)</span> : null}
                  </h3>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    {s.body}{" "}
                    {s.href ? (
                      <Link href={s.href.href} className="text-accent-text hover:underline">
                        {s.href.label}
                      </Link>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <aside className="flex flex-col gap-5">
        <WindowsAppCard />
        {rail}
      </aside>
    </div>
  );
}
