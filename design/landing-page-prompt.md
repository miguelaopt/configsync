# Prompt — ConfigSync landing page

Paste everything below the line into Claude (Claude Design, claude.ai, or Claude Code with the
`frontend-design` skill). It is self-contained: product facts, current brand, what is fixed and
what is free, constraints, process and deliverable. It starts by asking you four style questions
and then proposes directions; the direction you pick becomes the design system for the whole app.

---

## Role

You are the design lead on the public landing page for **ConfigSync**, a web app that stores,
organises, compares and syncs video-game settings. You give every client a look that is not
mistaken for anyone else's: deliberate, opinionated choices about palette, type and layout that
come from _this_ subject, not from a template. Design first, then hand over production-ready code.

**The landing page sets the style for the whole product.** The direction we agree on here becomes
the design system that the app (dashboard, game pages, settings, dialogs) is restyled to
afterwards. Think in terms of a system — tokens, type scale, spacing, component shapes, motion
rules — not a one-off marketing page.

## The page's job

A PC gamer lands here from a friend's public profile or a search. Within ten seconds they
should understand "it keeps my game settings in one place and puts them on any PC", believe it
is serious, and either create a free account or open a public preset. Everything on the page
serves that; anything that doesn't is cut.

## Step 0 — four questions, then directions

Ask me these one at a time and wait for each answer:

1. **Mood in three words**, and two or three products or sites whose look I admire (any field).
2. **Dark or light first** — the app is dark-first today: keep, flip, or both equal?
3. **What must not appear** — clichés, colours, layouts I dislike.
4. **Anything non-negotiable to include.**

Then propose **two or three directions**, each as a compact plan: 4–6 named hex colours, the
typefaces and their roles, a one-sentence layout concept with an ASCII wireframe of the hero,
and the principle that makes it distinct. Say which one you would pick and why. I choose;
you wait for my "go".

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
- **Companion (`csync`)** runs on the player's PC: scans installed Steam/Epic games, imports a
  game's config files as a preset, writes presets back to the files (with a backup first).
- **Pro:** unlimited games and history; **auto-switch** (`csync watch` keeps every PC's files
  equal to the chosen preset while the game is closed); **per-PC presets** (choose what each PC
  runs, see what is applied where); **AI screenshot importer** (upload screenshots of a settings
  menu, review the proposed values, apply).
- **Public profile** at `configsync.app/p/<username>`: presets and social links; visitors copy,
  download or save a preset into their own vault.
- **Plans:** Free (3 active games, 10 snapshots per preset, companion, public profile) and Pro at
  **2.99 €/month or 24.99 € once**. Payments via Paddle (merchant of record).
- **Privacy stance:** the web app only stores and copies settings; only the companion, run by the
  user, touches game files. No analytics, no trackers. Data exportable any time.
- Do **not** mention "open source", "source-available", GitHub or self-hosting anywhere.

## Audience and tone

PC gamers who tweak settings — competitive CS2 and Rocket League players, people with a desktop
and a laptop, streamers who share their config. Allergic to marketing fluff and to "gamer"
clichés (neon, RGB gradients, aggressive angles, dark-mode-with-acid-green). Tone: precise,
calm, confident, a little dry. Short sentences. Show the product, don't sell it.

## Raw material — the subject's own vernacular

Distinctive choices come from what this world actually looks like. Use these as material for
ideas, never as decoration: game options screens (rows, toggles, segmented choices, sliders,
key caps like `Mouse 4`, `Shift`); numbers with units (`800 DPI`, `1.85`, `1920×1080`, `240 Hz`);
`.cfg` / `.ini` syntax and the moment it becomes a menu; a diff between two presets; a preset
name travelling to a second PC; Steam launch options; the `.bak` backup the companion leaves
behind; the crosshair. **Never** game logos, game screenshots or recognisable game UI.

## Current brand — the starting point, not the ceiling

Implemented today in `app/globals.css` and `components/ui`:

- Dark-first. Surfaces `ground #12161c → surface #181d24 → raised #1f252e → overlay #262d38`;
  lines `#2a323d` / `#3a4553`; ink `#e6eaf0` / `#9aa5b4` / `#6b7684`. Light theme exists
  (`[data-theme="light"]`).
- One accent, "vault amber" `#e9b44c` (on-accent ink `#1a1408`). Semantic: good `#59c48d`,
  bad `#e5655c`, note `#6fa8ff`.
- Type: **Barlow Semi Condensed** 500/600 for display, **Geist Sans** for body, **Geist Mono**
  for code. Radii 2/4/6/10 px. Soft dark shadows.
- Logo: a square "vault dial" glyph (rounded square + circle + four amber ticks) and the
  wordmark `Config` + amber `Sync`. Original artwork.
- The app's rows use 13 px labels and tight spacing — that is the _app's_ density, not the
  landing page's type scale.

**Fixed:** the logo; exactly one accent colour; both themes must read; the app must stay
recognisable after the rollout. **Free:** the accent's hue, the typefaces, the type scale,
radii, surface stacking, density, motion — propose changes when they make the design more
specific to this subject, and say what the rollout costs.

Be aware that "near-black with one bright accent" and "spec sheet with hairlines and tiny
labels" are common defaults. Either is acceptable here **only** if you can say why ConfigSync
specifically earns it (the game-options vernacular is a real reason) and make it unmistakably
this product; otherwise propose something else.

## Page structure (suggested, not mandatory)

1. **Hero** — the most characteristic thing in this world, shown, not described: e.g. one
   settings row whose value changes and appears on a second machine; two presets diffed; a
   `.cfg` line becoming a menu row. Headline that says what the product does (working title
   "Your game settings. One place."). Primary action _Create a free account_, secondary
   _Sign in_. No "big number + small label + gradient" hero.
2. **How it works** — save (type or import), organise (presets, history, compare), sync
   (companion applies; Pro auto-switch and per-PC). This _is_ a sequence, so numbering is fine.
3. **Catalog + any game** — CS2 and Rocket League real menus, plus "add anything".
4. **Share** — public profile at `configsync.app/p/you`.
5. **Plans** — Free vs Pro, the two Pro prices, link to `/pricing` (checkout lives there).
6. **Trust** — companion-only file access, export any time, Paddle as merchant.
7. **Footer** — _Terms_, _Privacy_, _Refunds_, _Contact_ (`hello@configsync.app`). Already
   provided by the layout.

Spend boldness in one place. Let one element be the memorable thing and keep everything
around it quiet.

## Writing rules

Words are design content. Plain verbs, sentence case, active voice, no filler. A button says
what happens when pressed (_Create a free account_, not _Get started_). Name things the way a
player would (_presets_, _keybinds_, _your PCs_), not the way the system is built. No
ALL-CAPS labels, no eyebrow labels above headings, no meta strings joined with middle dots, no
arrows appended to links, no single word in the headline set in the accent colour (that is the
logo's trick, not the page's). Real copy from the facts above; no fake testimonials, logos or
numbers.

## Typography and motion

- One or two families, clearly distinct if two. Set a real type scale (Bringhurst-style
  ratios) with intentional weights and tracking; headlines are part of the design, not a
  delivery vehicle. Body lines under 80 characters.
- Contrast ≥ 4.5:1 for text, both themes. Check amber-on-dark and dark-on-amber.
- Motion: at most one orchestrated moment that explains something (a value travelling, a
  preset switching). No fade-and-slide-up on every section, no hover effects on every card.
  Respect `prefers-reduced-motion` — the page must be complete with motion off.

## Hard constraints

- Stack: **Next.js 16 App Router + React 19 + Tailwind CSS v4** with the tokens above exposed as
  utilities (`bg-ground`, `text-ink-2`, `border-line`, `text-accent`, `font-display`, …).
  Radix-based components live in `components/ui` (`Button` variants primary / secondary / ghost
  / link, sizes sm / md / lg; `Badge`, `Tooltip`, …). Reuse `Button` and `Logo`.
- Deliverable is **one file**: `app/(marketing)/page.tsx` (server component; it must start with
  `if (await getSession()) redirect("/dashboard")`). It renders inside the marketing layout
  (logo header, footer with legal links, `max-w-3xl` column — widen with your own wrapper if the
  design needs it). No new dependencies; no external images or fonts; inline SVG or CSS for
  visuals. Client components only where interaction genuinely needs them.
- Responsive from 360 px; keyboard and screen-reader friendly (real headings, alt text,
  visible focus). No layout shift; fonts are already loaded.
- Copy in English. Prices exactly as above.

## Process

1. After my "go": write the **plan** for the chosen direction — palette (4–6 named hex),
   type roles and scale, layout with ASCII wireframes for hero and one section, alignment,
   principles.
2. **Review the plan against this brief** before any code: for each part, ask whether you would
   have produced the same thing for any dark SaaS page. If yes, change it and say what changed
   and why.
3. Build `page.tsx`. Take screenshots at 1280 px and 400 px, in dark and light. Critique them:
   is the one memorable thing memorable, is everything else quiet, does it pass the "remove one
   accessory" test? Fix, re-shoot.
4. Only then hand over.

## Deliverable

1. Rationale (5–10 lines): the one idea, why it fits this subject, what you deliberately avoided.
2. The complete `page.tsx`, plus the four screenshots.
3. **The design system it implies**, so the rest of the app can follow: proposed changes to the
   tokens in `app/globals.css` (colours, radii, shadows, type scale) as a diff, and a list of
   `components/ui` pieces that would change (button shapes, inputs, badges, dialogs) with one
   line each on how. Keep it to what the landing page actually establishes.
