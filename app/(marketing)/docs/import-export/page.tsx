import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Import and export — back up your game settings as JSON, Markdown or CSV",
  description:
    "What a ConfigSync export contains and how to put it back: one JSON file with every game, preset, category and setting, plus Markdown and CSV for reading, and a ZIP of all three. Re-import it into any account.",
  alternates: { canonical: "/docs/import-export" },
};

const Cmd = ({ children }: { children: string }) => (
  <code className="rounded-xs bg-raised px-1.5 py-0.5 font-mono text-[13px] text-ink">
    {children}
  </code>
);

const Code = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-lg border border-line bg-raised p-4 font-mono text-[13px] leading-relaxed text-ink">
    {children}
  </pre>
);

/** The public answer to "what is actually in my backup, and can I get it back out?" */
export default function ImportExportDocsPage() {
  return (
    <LegalPage
      title="Import and export"
      updated={null}
      intro="Everything you put into ConfigSync comes back out as a file you keep, on every plan, without asking anyone. This page says exactly what is in that file and what happens when you put it back."
      footer={
        <footer className="panel flex flex-col gap-2 p-5 text-[13px] text-ink-3">
          <span className="font-medium text-ink">Exporting is on the Export page</span>
          <span>
            Signed in, open <strong className="text-ink">Export</strong> in the sidebar. No account
            yet?{" "}
            <Link href="/sign-up" className="text-accent-text hover:text-ink">
              Create a free account
            </Link>{" "}
            — the full library export is not a Pro feature and never will be.
          </span>
        </footer>
      }
    >
      <Section title="The four formats">
        <p>
          Every export covers your whole library, a single game, or a single preset. You choose the
          scope on the Export page, and whether archived games and presets are included.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong className="text-ink">JSON</strong> — the complete one. This is the backup to
            keep, and the only format that can be imported back.
          </li>
          <li>
            <strong className="text-ink">Markdown</strong> — for reading and pasting: one heading
            per game, preset and category, then <Cmd>- Name: value</Cmd> lines.
          </li>
          <li>
            <strong className="text-ink">CSV</strong> — one row per setting, for a spreadsheet:{" "}
            <Cmd>game,preset,category,setting,type,value,unit,notes</Cmd>.
          </li>
          <li>
            <strong className="text-ink">ZIP</strong> — all three of the above in one download.
          </li>
        </ul>
      </Section>

      <Section title="What the JSON contains">
        <p>
          One document with your games, and inside each game its presets, categories and settings.
          Each setting keeps its type, its value, its unit, its allowed range or options, its
          default, and your own description and notes — so a restored preset is the same preset, not
          a list of numbers.
        </p>
        <Code>{`{
  "format": "gamesettings-vault",
  "version": 1,
  "kind": "library",
  "exportedAt": "2026-09-22T10:00:00.000Z",
  "games": [
    {
      "name": "Counter-Strike 2",
      "presets": [
        {
          "name": "Competitive",
          "isDefault": true,
          "categories": [
            {
              "name": "Mouse",
              "settings": [
                { "name": "Sensitivity", "type": "decimal", "value": 2.4 }
              ]
            }
          ]
        }
      ]
    }
  ]
}`}</Code>
        <p>
          The <Cmd>format</Cmd> string is the original internal name of the file type and has not
          been changed, so that files exported a year ago still import today.
        </p>
      </Section>

      <Section title="What is not in it">
        <p>
          A cover image you uploaded stays on the server; the file keeps only a link if the cover
          came from a URL. Snapshot history is not exported — an export is the current state of each
          preset, not every version of it. Nothing about your account, your password, your devices
          or your payments is in the file.
        </p>
        <p>
          When someone else exports one of your <em>public</em> presets, your private notes are
          removed from that copy. They are yours, and they do not travel with a shared preset.
        </p>
      </Section>

      <Section title="Putting a backup back">
        <p>
          The Import page walks through{" "}
          <strong className="text-ink">Source → Review → Import</strong>. Upload the JSON file or
          paste it in, look at every game, preset and setting it proposes, then confirm. Nothing is
          written to your library until that last step, and reviewing or comparing never changes
          anything.
        </p>
        <p>
          A game whose name matches one you already have is merged into: its presets arrive
          alongside your existing ones rather than replacing the game. You can also pick which game
          they should land in.
        </p>
      </Section>

      <Section title="When a preset already exists">
        <p>
          Presets are matched by name. You choose what happens to the whole file, and can then
          override any single conflict:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong className="text-ink">Keep both</strong> — the default. The incoming one arrives
            as a numbered copy, <Cmd>Competitive (2)</Cmd>. Nothing you had is touched.
          </li>
          <li>
            <strong className="text-ink">Skip duplicates</strong> — the preset you already have
            wins, and the incoming one is discarded.
          </li>
          <li>
            <strong className="text-ink">Replace existing</strong> — the matched preset and its
            snapshot history are deleted before the replacement is written. If it was the default
            preset, the replacement takes that role.
          </li>
        </ul>
        <p>
          <strong className="text-ink">Compare differences</strong> puts the current and incoming
          values side by side, using the same comparison the app uses everywhere else, before either
          is changed.
        </p>
      </Section>

      <Section title="Importing a game's own config files">
        <p>
          The same page has a <strong className="text-ink">Game config</strong> tab for the other
          direction: pick a game from{" "}
          <Link href="/for" className="text-accent-text hover:text-ink">
            the catalog
          </Link>{" "}
          and drop its real config files in, in any order. Filenames are matched against the
          catalog, including Counter-Strike 2&rsquo;s per-user slot folders and its <Cmd>.vcfg</Cmd>{" "}
          files.
        </p>
        <p>
          The review step marks every value that was <em>not</em> found in your files as{" "}
          <strong className="text-ink">Catalog default</strong>, so you can tell what the game
          actually told us from what is merely the usual value. If nothing could be read, import
          stays disabled rather than saving an empty preset.
        </p>
      </Section>

      <Section title="If the file is wrong">
        <p>
          The file is checked before anything is written, and a problem is reported with the exact
          place it was found — <Cmd>games[0].presets[1].name</Cmd> — while your library is left
          untouched. Fields we do not recognise are ignored rather than rejected, so a file from a
          newer version still imports.
        </p>
        <p>
          One file can carry up to 500 games, 200 presets per game, 200 categories per preset and
          1&nbsp;000 settings per category. A normal library is nowhere near any of these.
        </p>
      </Section>
    </LegalPage>
  );
}
