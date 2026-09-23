/**
 * What changed, newest first. Add an entry per release; the page and the sitemap read this file.
 * Write for the person using the product, not for the person who wrote the code.
 */
export type ChangeKind = "new" | "improved" | "fixed";

export type ChangelogEntry = {
  /** ISO date, also the anchor. */
  date: string;
  /** The package.json version this shipped as. */
  version: string;
  title: string;
  changes: { kind: ChangeKind; text: string }[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-09-23",
    version: "0.12.1",
    title: "Refunds take Pro back",
    changes: [
      {
        kind: "fixed",
        text: "A refund now removes Pro, as the refund policy says it does. The billing webhook was rejecting Paddle's refund notifications before reading them, so a refunded account kept Pro indefinitely.",
      },
    ],
  },
  {
    date: "2026-09-23",
    version: "0.12.0",
    title: "The companion answers in JSON",
    changes: [
      {
        kind: "new",
        text: "csync 0.4.0: a new `csync status` shows what this PC is connected to and which preset each game should run. With `--json`, it and `csync apply` and `csync import` answer in JSON, so other tools \u2014 including the desktop app being built \u2014 can drive the companion.",
      },
    ],
  },
  {
    date: "2026-09-22",
    version: "0.11.0",
    title: "Less of us on every page, and a straight answer about cookies",
    changes: [
      {
        kind: "improved",
        text: "The founder offer was redrawn: what you get, what it costs, and the code already applied, in one card.",
      },
      {
        kind: "new",
        text: "A one-line cookie notice on your first visit. It informs, it does not ask \u2014 signed out this site sets no cookies at all, and signing in sets only the one that keeps you signed in, so there is nothing to consent to.",
      },
      {
        kind: "improved",
        text: "Our business details no longer sit at the bottom of every page. The full name and address live on /contact, where they are meant to be reachable, and the VAT number is gone from the site \u2014 Paddle puts its own on your invoice.",
      },
    ],
  },
  {
    date: "2026-09-22",
    version: "0.10.1",
    title: "Payment links open",
    changes: [
      {
        kind: "fixed",
        text: "A payment link from Paddle \u2014 the kind an \u201cupdate your payment method\u201d email sends you to \u2014 now opens its checkout on the pricing page. It used to land on a page that could not open one unless you happened to be signed in on the Free plan.",
      },
    ],
  },
  {
    date: "2026-09-22",
    version: "0.10.0",
    title: "A code for the founder offer",
    changes: [
      {
        kind: "improved",
        text: "The alpha founder offer now comes as a code you can copy, keep and pass on, instead of a discount that only worked if you arrived the right way. Opening Pro from the offer still fills it in for you.",
      },
      {
        kind: "fixed",
        text: "When a checkout cannot open, the reason is shown instead of a blank \u201cSomething went wrong\u201d. Nothing is ever charged when that happens.",
      },
    ],
  },
  {
    date: "2026-09-22",
    version: "0.9.0",
    title: "Help us support the games you play",
    changes: [
      {
        kind: "new",
        text: "csync 0.3.0: the new `csync discover` command finds the config files of any game you have installed — including games ConfigSync does not support yet — and, after you change one setting in the game, shows you exactly which lines it wrote. Send those lines in and the game can be mapped properly. It needs no account, and nothing leaves your PC.",
      },
    ],
  },
  {
    date: "2026-09-22",
    version: "0.8.1",
    title: "Two more CS2 settings sync themselves",
    changes: [
      {
        kind: "improved",
        text: "Counter-Strike 2: Maximum FPS In Game and Audio → Perspective Correction are now read from and written to CS2's own files, instead of being typed in by hand. They live in cs2_machine_convars.vcfg, which the companion now reads alongside the other three.",
      },
    ],
  },
  {
    date: "2026-09-22",
    version: "0.8.0",
    title: "Two pages that were missing",
    changes: [
      {
        kind: "new",
        text: "/docs/import-export explains exactly what a ConfigSync export contains, what is deliberately left out of it, and what happens to a preset you already have when you import one with the same name.",
      },
      {
        kind: "new",
        text: "/contact: one address, and what to expect when you write about support, an invoice, a refund, your data, a security report or a game you want in the catalog.",
      },
    ],
  },
  {
    date: "2026-09-22",
    version: "0.7.0",
    title: "Alpha founder offer",
    changes: [
      {
        kind: "new",
        text: "While ConfigSync is in alpha, the lifetime Pro licence is 10 € instead of 24.99 € — the same Pro, paid once, for as long as this hosted service runs. The discount is applied at checkout; the monthly plan is unchanged at 2.99 €/month.",
      },
    ],
  },
  {
    date: "2026-09-22",
    version: "0.6.2",
    title: "The companion checks twice",
    changes: [
      {
        kind: "fixed",
        text: "csync 0.2.1: `csync apply` and `csync launch` now refuse to write while the game is open, the same way `csync watch` always has. Close the game and run it again. Auto-switch also re-checks immediately before writing, so a game started mid-apply no longer gets its files changed underneath it.",
      },
      {
        kind: "fixed",
        text: "On Linux the companion now recognises a running game by its executable, not only by its reported name — a game that renames itself while running is no longer mistaken for a closed one.",
      },
    ],
  },
  {
    date: "2026-09-21",
    version: "0.6.1",
    title: "A cleaner welcome",
    changes: [
      {
        kind: "improved",
        text: "Sign in and account creation now use sharper, high-resolution ConfigSync artwork, and the home page has a cleaner, quieter hero.",
      },
    ],
  },
  {
    date: "2026-09-20",
    version: "0.6.0",
    title: "The companion is one file",
    changes: [
      {
        kind: "new",
        text: "csync 0.2.0: Windows users download one executable; Linux users run one curl line. No Node, no npm, nothing else to install — the companion carries its own runtime.",
      },
      {
        kind: "improved",
        text: "On Windows the companion finds Steam wherever it is installed, not only under Program Files.",
      },
      {
        kind: "improved",
        text: "csync games prints the exact Steam launch option for this machine, with the full path.",
      },
    ],
  },
  {
    date: "2026-09-20",
    version: "0.5.1",
    title: "Settings, tidied",
    changes: [
      {
        kind: "improved",
        text: "Settings has a section list that follows you down the page, and the public profile link can be copied or opened right next to its switch.",
      },
      {
        kind: "improved",
        text: "The companion install commands have a copy button.",
      },
      {
        kind: "improved",
        text: "Import, Search and Settings sit on the left like every other page, and page titles carry the brand gradient.",
      },
    ],
  },
  {
    date: "2026-09-20",
    version: "0.5.0",
    title: "Export, rebuilt",
    changes: [
      {
        kind: "new",
        text: "Download all as ZIP: JSON, Markdown and CSV of your whole library in one file.",
      },
      {
        kind: "new",
        text: "Recent exports: what you downloaded from this browser, with size and time, and a one-click way to export it again with today's data.",
      },
      {
        kind: "improved",
        text: "One switch decides whether archived games and presets go into every export; JSON is marked as the backup to keep.",
      },
      {
        kind: "new",
        text: "A changelog — this page — and a version number that moves with it.",
      },
    ],
  },
  {
    date: "2026-09-20",
    version: "0.4.0",
    title: "A page for every game, and the companion guide goes public",
    changes: [
      {
        kind: "new",
        text: "Counter-Strike 2 and Rocket League each have their own page: every setting by name with the config key it maps to, the files the companion reads on each launcher, and the three commands to get going.",
      },
      {
        kind: "new",
        text: "Installing the companion no longer needs an account to read about: the guide is at /docs/companion.",
      },
      {
        kind: "improved",
        text: "Settings, Export, Search, Compare and Import now use the same cards as the dashboard. The 404 and error pages look like the rest of the site.",
      },
      {
        kind: "fixed",
        text: "The Public profile switch saves the moment you flip it. It used to wait for Save profile, which read as already done.",
      },
    ],
  },
  {
    date: "2026-09-19",
    version: "0.3.0",
    title: "Review before you import",
    changes: [
      {
        kind: "new",
        text: "Import walks through Source → Review → Import for both ConfigSync backups and game config files, so you see every proposed value — and every conflict — before anything is saved.",
      },
      {
        kind: "new",
        text: "Backup conflicts show the current and incoming preset side by side, with keep, skip or replace per preset.",
      },
      {
        kind: "improved",
        text: "The whole app moved to the dark Nocturne look: new dashboard with sync status and recent activity, library and preset pages rebuilt, one brand from the landing page to the last dialog.",
      },
      {
        kind: "fixed",
        text: "Rocket League's real file names and CS2's slot variants are recognised on import.",
      },
    ],
  },
  {
    date: "2026-09-18",
    version: "0.2.0",
    title: "ConfigSync is live",
    changes: [
      {
        kind: "new",
        text: "configsync.app opens to everyone: Free keeps three games with ten snapshots per preset; Pro is 2.99 €/month or 24.99 € once.",
      },
      {
        kind: "new",
        text: "Per-PC presets: pick which preset each of your machines should run, and see what each one last applied and when.",
      },
      {
        kind: "new",
        text: "Screenshot importer (Pro): upload photos of a game's settings menu and tick the values you want applied.",
      },
      {
        kind: "new",
        text: "Public profiles at /p/<username>, with the presets you choose to share and your Twitch, YouTube or Discord links.",
      },
    ],
  },
  {
    date: "2026-09-17",
    version: "0.1.0",
    title: "The foundation",
    changes: [
      {
        kind: "new",
        text: "Games, presets, categories and settings that mirror a game's own menu; Counter-Strike 2 and Rocket League ship with theirs.",
      },
      {
        kind: "new",
        text: "The companion CLI: csync scans installed games, imports their config files as presets, applies presets back with a backup, and csync watch keeps every PC on the preset you chose.",
      },
      {
        kind: "new",
        text: "Compare any two presets, copy any setting as text, Markdown or JSON, and export the whole library.",
      },
    ],
  },
];
