import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/marketing/legal";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Companion CLI — install csync and sync game configs",
  description:
    "Install the ConfigSync companion (csync) on your gaming PC: it imports your game config files as presets, applies them back with a backup, and keeps every PC on the preset you chose. CS2 and Rocket League supported.",
  alternates: { canonical: "/docs/companion" },
};

const Code = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-lg border border-line bg-raised p-4 font-mono text-[13px] leading-relaxed text-ink">
    {children}
  </pre>
);
const Cmd = ({ children }: { children: string }) => (
  <code className="rounded-xs bg-raised px-1.5 py-0.5 font-mono text-[13px] text-ink">
    {children}
  </code>
);

/** Public copy of the install steps that Settings → Companion shows signed-in users. */
export default function CompanionDocsPage() {
  return (
    <LegalPage
      title="Companion CLI"
      intro="csync runs on your gaming PC. It finds the config files of the games you play, imports them into ConfigSync as presets, and writes a preset back into those files — with a backup every time. Plain Node 20+, no dependencies, and it only ever touches files on your own machine."
      updated={null}
      footer={
        <footer className="panel flex flex-col gap-2 p-5 text-[13px] text-ink-3">
          <span className="font-medium text-ink">Ready to try it?</span>
          <span>
            <Link href="/sign-up" className="text-accent-text hover:text-ink">
              Create a free account
            </Link>
            , add a game from the catalog, then come back here for the install line.
          </span>
        </footer>
      }
    >
      <Section title="Install">
        <p>
          The package is served by this site — no registry account, nothing else to install. npm
          refuses to fetch a package straight from a URL, hence the download step.
        </p>
        <Code>{`curl -fsSL ${SITE.url}/csync.tgz -o csync.tgz && npm i -g ./csync.tgz\ncsync --help`}</Code>
      </Section>

      <Section title="Connect it to your account">
        <p>
          In the app, open <strong className="text-ink">Settings → Companion</strong> and create a
          token — one per machine, so you can revoke them separately. Then:
        </p>
        <Code>{`csync login ${SITE.url}      # paste the token when asked\ncsync scan --push            # tell the vault which games this PC has\ncsync import cs2             # read CS2's config files into a new preset`}</Code>
        <p>
          <Cmd>csync games</Cmd> lists every catalog game and which of its files were found on this
          machine. Games currently in the catalog: Counter-Strike 2 (<Cmd>cs2</Cmd>) and Rocket
          League (<Cmd>rocket-league</Cmd>), on Steam, Epic and Heroic.
        </p>
      </Section>

      <Section title="Apply a preset">
        <p>
          <Cmd>csync apply cs2 competitive</Cmd> writes the preset into the game&rsquo;s files.
          Every file is copied to <Cmd>{"<file>.bak-<timestamp>"}</Cmd> first, only the keys the
          catalog maps are changed, and <Cmd>--dry-run</Cmd> prints the changes without writing.
          Close the game first: games rewrite their config on exit.
        </p>
      </Section>

      <Section title="Keep every PC in sync (Pro)">
        <p>
          <Cmd>csync watch --install</Cmd> starts a small background service with your session. It
          asks the vault every 30 seconds which preset this PC should have — the one you picked for
          it on the game page, otherwise the game&rsquo;s Default — and applies it as soon as the
          game is closed. Change the Default from your phone; the PC follows.
        </p>
        <Code>{`csync watch --install     # start with your session\ncsync watch --once        # one pass, for scripts\ncsync watch --uninstall`}</Code>
      </Section>

      <Section title="Apply right before launch">
        <p>
          The background poll can be late for the moment you press Play. <Cmd>csync launch</Cmd>{" "}
          applies the preset and then runs the game, so the files are right when the game reads
          them. If the vault is unreachable it says so and launches anyway.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Steam → game → Properties → Launch Options: <Cmd>csync launch cs2 -- %command%</Cmd>
          </li>
          <li>
            Heroic → game → Settings → Advanced → Wrapper: <Cmd>csync launch rocket-league --</Cmd>
          </li>
        </ul>
      </Section>

      <Section title="Safety">
        <ul className="list-disc space-y-1 pl-5">
          <li>Nothing is written without a backup next to the file. Copy it back to undo.</li>
          <li>
            Only keys the catalog maps are touched; the rest of the file is kept byte for byte.
          </li>
          <li>
            <Cmd>import</Cmd> always creates a new preset. Nothing in your account is overwritten.
          </li>
          <li>
            Steam Cloud may restore an older file on launch. If a change disappears, disable Cloud
            sync for that game and apply again.
          </li>
          <li>
            The token is stored in <Cmd>~/.config/csync/config.json</Cmd> (
            <Cmd>%APPDATA%\csync</Cmd> on Windows), readable only by you. Revoke it any time from
            Settings.
          </li>
        </ul>
      </Section>

      <Section title="Commands">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-line">
              {[
                ["csync login <url>", "Save a token for this machine."],
                [
                  "csync scan [--push]",
                  "List installed Steam / Epic / Heroic games; --push updates the vault.",
                ],
                ["csync games", "Catalog games and which of their files exist here."],
                ["csync import <game> [--name …]", "Read the files into a new preset."],
                [
                  "csync apply <game> <preset> [--dry-run]",
                  "Write a preset into the files, after a backup.",
                ],
                [
                  "csync watch [--interval 30] [--once]",
                  "Pro. Keep the files equal to this PC's preset.",
                ],
                ["csync launch <game> -- <command…>", "Apply, then run the command."],
              ].map(([cmd, what]) => (
                <tr key={cmd}>
                  <td className="py-2 pr-4 align-top font-mono whitespace-nowrap text-ink">
                    {cmd}
                  </td>
                  <td className="py-2 align-top">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </LegalPage>
  );
}
