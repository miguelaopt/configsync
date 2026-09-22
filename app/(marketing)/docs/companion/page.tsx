import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/marketing/legal";
import { LEGAL } from "@/lib/legal";
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
      intro="csync runs on your gaming PC. It finds the config files of the games you play, imports them into ConfigSync as presets, and writes a preset back into those files — with a backup every time. One file to download, nothing else to install, and it only ever touches files on your own machine."
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
      <Section title="Install on Windows">
        <p>
          Download{" "}
          <a href="/csync-windows-x64.exe" className="text-accent-text hover:text-ink" download>
            csync.exe
          </a>{" "}
          (about 90 MB — it carries its own runtime) and put it somewhere it can stay, for example{" "}
          <Cmd>C:\Tools\csync.exe</Cmd>. Open PowerShell in that folder; every command below is{" "}
          <Cmd>.\csync.exe …</Cmd> there.
        </p>
        <p>
          The first run may show &ldquo;Windows protected your PC&rdquo;: the file is not
          code-signed yet. <strong className="text-ink">More info → Run anyway</strong>, or
          right-click the file → Properties → Unblock.
        </p>
      </Section>

      <Section title="Install on Linux">
        <Code>{`curl -fsSL ${SITE.url}/install.sh | sh\ncsync --help`}</Code>
        <p>
          That puts <Cmd>csync</Cmd> in <Cmd>~/.local/bin</Cmd>. Steam, Heroic and the Flatpak Steam
          are all found; Proton prefixes are searched for Windows-only games.
        </p>
      </Section>

      <Section title="Connect it to your account">
        <p>
          In the app, open <strong className="text-ink">Settings → Companion</strong> and create a
          token — one per machine, so you can revoke them separately. Then:
        </p>
        <Code>{`csync login ${SITE.url}      # paste the token when asked\ncsync scan --push            # tell the vault which games this PC has\ncsync import cs2             # read CS2's config files into a new preset`}</Code>
        <p>
          <Cmd>csync games</Cmd> lists every catalog game and which of its files were found on this
          machine, and prints the exact Steam launch option for each. Games currently in the
          catalog: Counter-Strike 2 (<Cmd>cs2</Cmd>) and Rocket League (<Cmd>rocket-league</Cmd>),
          on Steam, Epic and Heroic.
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

      <Section title="Help us support a game you play">
        <p>
          A game can only be read and written once we know which key in which file holds each
          setting, and the honest way to learn that is to change one setting and see what moved.{" "}
          <Cmd>csync discover</Cmd> does that for you, for any game you have installed:
        </p>
        <Code>{`csync discover                        # installed games + where config lives
csync discover "Apex Legends"         # remember those files as they are
#  → change ONE setting in the game, then quit it
csync discover "Apex Legends" --diff  # the lines that setting wrote`}</Code>
        <p>
          The last command prints the lines that changed — which is exactly the key that setting
          writes. Send those lines to{" "}
          <a href={`mailto:${LEGAL.email}`} className="text-accent-text hover:text-ink">
            {LEGAL.email}
          </a>{" "}
          and the game can be mapped properly.
        </p>
        <p>
          It works signed out and sends nothing anywhere: what it remembers stays in a file on your
          own machine, readable only by you. Look at the diff before sharing it — it is plain text,
          and you decide what goes in the email.
        </p>
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
                [
                  "csync discover [game] [--diff]",
                  "Find an unsupported game's config files and which keys a setting writes.",
                ],
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
