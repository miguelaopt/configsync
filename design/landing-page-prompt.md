# Prompt — ConfigSync landing page

Paste everything below the line into Claude (Claude Design, claude.ai, or Claude Code with the
`frontend-design` skill). It is self-contained: product facts, brand tokens, constraints and the
deliverable. Adjust the "Direction" section to taste before sending.

---

## Role

You are designing the public landing page for **ConfigSync**, a web app that stores, organises,
compares and syncs video-game settings. You are a product designer with strong front-end taste:
opinionated, restrained, allergic to generic SaaS templates. Design first, then hand over
production-ready code.

## What the product is (facts — do not invent features)

- **One place for game settings.** Users store the settings they use for any game — mouse
  sensitivity, keybinds, graphics, audio, crosshair, anything — in an interface that feels like
  the game's own settings menu, not a spreadsheet. Any game can be added; nothing is hard-coded.
- **Real menus from the catalog.** Counter-Strike 2 and Rocket League come with their actual
  settings menus, names and options.
- **Presets.** Several setups per game (Main, Competitive, Laptop…). Duplicate, compare side by
  side, archive, set a Default. Every meaningful save keeps a snapshot that can be restored.
- **Copy and export.** One setting, a category or a whole preset as plain text, Markdown, CSV or
  JSON. Full JSON export/import.
- **Companion CLI (`csync`)** runs on the player's PC: scans installed Steam/Epic games, imports a
  game's config files as a preset, writes presets back to the files (with a backup first).
- **Pro features:** unlimited games and history; **auto-switch** (`csync watch` keeps every PC's
  files equal to the chosen preset while the game is closed); **per-PC presets** (choose what
  each PC runs, see what is applied where); **AI screenshot importer** (upload screenshots of a
  settings menu, review the proposed values, apply).
- **Public profile** at `/p/<username>`: presets and social links; visitors copy, download or save
  a preset into their own vault.
- **Plans:** Free (3 active games, 10 snapshots per preset, companion, public profile) and Pro at
  **2.99 €/month or 24.99 € once**. Payments via Paddle (merchant of record).
- **Privacy stance:** the web app only stores and copies settings; only the companion, run by the
  user, touches game files. No analytics, no trackers. Data exportable any time.
- Do **not** mention "open source", "source-available", GitHub or self-hosting anywhere.

## Audience and tone

PC gamers who tweak settings — competitive CS2/Rocket League players, people with a desktop
and a laptop, streamers who share their config. They are allergic to marketing fluff and to
"gamer" clichés (no neon, no RGB gradients, no aggressive angles). Tone: precise, calm,
confident, a little dry. Short sentences. Show the product, don't sell it.

## Brand (already implemented — reuse, don't reinvent)

- **Dark-first.** Surfaces stack `ground #12161c → surface #181d24 → raised #1f252e → overlay #262d38`.
  Lines `#2a323d` / strong `#3a4553`. Ink `#e6eaf0`, secondary `#9aa5b4`, tertiary `#6b7684`.
- **One accent, "vault amber" `#e9b44c`** (on-accent ink `#1a1408`, soft `rgb(233 180 76 / .14)`).
  Semantic: good `#59c48d`, bad `#e5655c`, note `#6fa8ff`. Light theme exists (`[data-theme="light"]`)
  and must still read correctly; design dark, check light.
- **Type:** display = **Barlow Semi Condensed** 500/600 (headings, numbers); body = Geist Sans;
  code = Geist Mono. Radii are small: 2/4/6/10 px. Shadows are soft and dark.
- **Logo:** a square "vault dial" glyph (rounded square + circle + four amber ticks) followed by
  the wordmark `Config` + amber `Sync`. Original artwork; never use game logos or screenshots of
  games' UI.
- The app's own UI is the visual reference: rows with game-menu-style controls (toggles,
  segmented choices, sliders, key caps), 13px labels, tight spacing, thin hairlines.

## Direction (edit this)

Something between a well-made hardware spec sheet and a game's options screen. Structure and
density over decoration. Let one big idea carry the hero: the same settings, on every machine,
without touching files by hand. Consider a faithful mock of the product's settings rows as the
hero visual (it _is_ the product) rather than an abstract illustration. Motion: subtle, only
where it explains something (a preset switching, a PC picking it up).

## Page structure (suggested, not mandatory)

1. **Hero** — tagline "Your game settings. One place." (or better), one sentence, primary CTA
   _Create a free account_, secondary _Sign in_. A product visual.
2. **How it works** — three beats: save (type or import), organise (presets, history, compare),
   sync (companion applies; Pro auto-switch, per-PC).
3. **Catalog + any game** — CS2 and Rocket League "real menus", plus "add anything".
4. **Share** — public profile at `configsync.app/p/you`.
5. **Plans** — Free vs Pro, the two Pro prices, link to `/pricing` (checkout lives there).
6. **Trust line** — companion-only file access, export any time, Paddle as merchant.
7. **Footer** — links _Terms_, _Privacy_, _Refunds_, _Contact_ (`hello@configsync.app`).

## Hard constraints

- Stack: **Next.js 16 App Router + React 19 + Tailwind CSS v4** with the tokens above exposed as
  utilities (`bg-ground`, `text-ink-2`, `border-line`, `text-accent`, `font-display`, …).
  Radix-based components exist in `components/ui` (`Button` with variants primary/secondary/
  ghost/link and sizes sm/md/lg, `Badge`, `Tooltip`, …). Reuse `Button`, `Logo`.
- Deliverable is **one file**: `app/(marketing)/page.tsx` (server component; it must start with
  `if (await getSession()) redirect("/dashboard")`). It renders inside the existing marketing
  layout (logo header, footer with legal links, `max-w-3xl` content column — you may widen the
  column with your own wrapper if the design needs it). No new dependencies; no external images;
  inline SVG or CSS for visuals. Client components only where interaction genuinely needs them.
- Responsive from 360 px up; keyboard and screen-reader friendly (real headings, alt text,
  visible focus). Lighthouse-clean: no layout shift, no blocking fonts (fonts are already loaded).
- Copy is English. Prices exactly as above. No fake testimonials, logos or numbers.

## Deliverable

1. A short rationale (5–10 lines): the one idea, the layout, why it fits the brand.
2. The complete `page.tsx`.
3. A list of any new shared component or token you needed (ideally none).
