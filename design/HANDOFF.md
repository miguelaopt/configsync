# ConfigSync landing page — handoff (direction A, approved)

Step 0 is done and a direction is chosen. Do not re-ask the four questions or
re-propose directions. Start at "Process" below. Load the frontend-design skill
first. Work in the real app repo (app/globals.css, components/ui, the marketing
layout live there).

## Direction A — "The options screen"

The page is set in the app's own grammar: rows, segmented choices, keycaps,
values with units. The hero is the app at real scale — game → preset →
settings — and it works. Every other section is the same rows at smaller scale.
Boldness is spent once, in the hero; everything else is quiet.

### Palette (dark, default)
- Stage `#0e1115` — page ground, one step darker than the app (new token)
- Ground `#12161c` — the app's ground; every demo panel sits on it
- Raised `#1f252e` — rows, controls
- Line `#2a323d`
- Ink `#e6eaf0` / Ink-2 `#9aa5b4`
- Vault amber `#e9b44c`, on-accent ink `#1a1408`

Verified contrast: amber on ground 9.6:1, on stage 10:1, dark-on-amber 9.7:1,
ink-2 on ground 7.3:1. Ink-3 `#6b7684` on ground is 3.9:1 — use it only for
non-text or ≥ 18 px, or bump it. Light theme: amber text must switch to a
deeper amber (`#7a4f08` = 7.1:1 on white; `#8a5a0a` = 5.9:1); button fills
keep `#e9b44c` with `#1a1408` ink.

### Type
- Barlow Semi Condensed 600 for headlines, 500 for row labels inside demos
  (condensed sans is what options menus are set in — that is why it stays)
- Geist Sans body 16/1.55, measure ≤ 64ch
- Geist Mono only for values with units (1.85, 800 DPI, 1920 × 1080, 240 Hz)
- Scale (major third, base 16): 13 · 16 · 20 · 25 · 31 · 39 · 49
- Hero h1 ~44 px desktop / 31 px mobile. Strong, not giant.

### Layout
One left-aligned column. Text at 640 px, demos widen to 1040 px (own wrapper
inside the layout's max-w-3xl). Nothing centred, no grid of equal cards.

### Hero
```
  Your settings. Every game. Every PC.
  Save them once. Keep presets per game, compare
  two, sync every PC, restore any save.

  [ Create a free account ]   Sign in
  Free: 3 games, companion, public profile.

  ┌ Counter-Strike 2 │ Rocket League │ + Add a game ────────────────┐
  │  Main   Competitive   Laptop                 ● Synced · 2 PCs   │
  │─────────────────────────────────────────────────────────────────│
  │  Mouse                                                          │
  │  Sensitivity              ◂  1.85  ▸                            │
  │  DPI                         800                                │
  │  Raw input                 [ On ]  Off                          │
  │  Video                                                          │
  │  Resolution               1920 × 1080   ▾                       │
  │  Refresh rate             240 Hz                                │
  │  Keys                                                           │
  │  Jump                     [Space]  [Mouse 4]                    │
  └─────────────────────────────────────────────────────────────────┘
```
- Game tabs switch the menu: CS2 (mouse/video/keys) ↔ Rocket League (camera:
  FOV 110, Distance 270, Height 100, Stiffness 0.45, Angle −3.0, Deadzone 0.05;
  Powerslide [Shift]) ↔ "Add a game" (empty menu, one line inviting input).
- Preset tabs switch values (Laptop: 1600 × 900, 144 Hz). Main / Competitive /
  Laptop are the preset names.
- The ONE motion moment: change a value → status goes
  "1 unsynced change → Syncing → Synced · 2 PCs". Nothing else animates.
  With prefers-reduced-motion the states still change, without transition.
- Client component for the hero panel only; the page stays a server component.
- Page <title>: "Your game settings. One place."

### Sections (each demonstrates one real capability with the same row grammar)
1. Hero — as above.
2. Presets and history — one game, three presets; a list of saves
   (timestamp, what changed) with a Restore action. Set Default, Duplicate,
   Archive visible as actions, not prose.
3. Compare — two preset columns, changed rows marked; identical rows dimmed.
   Show exactly what differs (e.g. Sensitivity 1.85 → 2.10, Refresh 240 → 144).
4. Sync — the same row on two PCs (Desktop, Laptop). Status states: Synced,
   Syncing, Unsynced changes. Companion (csync) is SHIPPED: scans Steam/Epic,
   imports config files as a preset, writes presets back with a .bak first.
   Pro: auto-switch (csync watch), per-PC presets.
5. Catalog and any game — CS2 and Rocket League real menus; any game can be
   added. Frame as a catalog that grows; no claimed size.
6. Share — configsync.app/p/you: presets and social links; visitors copy,
   download or save a preset into their vault.
7. Export — one setting, a category or a preset as text, Markdown, CSV, JSON;
   full JSON export/import. Can merge into 2 if it gets long.
8. Plans — compact. Free (3 active games, 10 snapshots per preset, companion,
   public profile) vs Pro at 2.99 €/month or 24.99 € once. Link to /pricing.
   Keep "Free" visible near the primary action everywhere it appears.
9. Privacy and data — plain language: the web app only stores and copies
   settings; only the companion, run by the user, touches game files; no
   analytics, no trackers; export any time; Paddle is merchant of record.
10. Final CTA — Create a free account.
Footer (Terms, Privacy, Refunds, Contact hello@configsync.app) comes from the
layout. Cut any section that does not demonstrate something.

## Decisions already made (do not reopen)
- Dark-first, keep. Light must still read.
- Do NOT mention open source, source-available, GitHub or self-hosting.
- Companion is shipped, not "coming soon".
- Sync states are Synced / Syncing / Unsynced changes. No conflict-resolution UI
  (not a product fact).
- "Presets" = per-game setups. "Profile" = only the public page /p/username.
- "Every PC", not "every device".
- No section for "the problem"; the subline carries it.
- Changelog/Roadmap link and a persistent header CTA belong to the layout
  header, not page.tsx. Put the CTA in the hero and the final section; list the
  header change as a rollout item in the handover.

## Must not appear
Neon/RGB, purple-blue-pink gradients, glowing borders, black + electric blue,
glassmorphism/blur, giant hero type, stock gaming imagery, 3-column
icon-title-paragraph rows, rounded-card grids and pills, one giant dashboard
screenshot with blobs, 3D objects, futuristic type, heavy shadows or glows,
scroll-jacking, fade-and-slide on every section, hover effects on every card,
fake metrics/testimonials/logos, pricing dominating the page, marketing walls
of text, game logos/screenshots/recognisable game UI, ALL-CAPS labels, eyebrow
labels, "A · B · C" meta strings, "→" on links, one accent-coloured word in a
headline.

## Writing
Plain verbs, sentence case, active voice, short sentences, a little dry.
Buttons say what happens: "Create a free account", "Sign in", "Restore",
"Copy preset". Name things as a player would. Real copy from the facts only.
Prices exactly: 2.99 €/month, 24.99 € once.

## Hard constraints
- Next.js 16 App Router, React 19, Tailwind v4; tokens exposed as utilities
  (bg-ground, text-ink-2, border-line, text-accent, font-display, …).
- Reuse Button (primary / secondary / ghost / link; sm / md / lg) and Logo from
  components/ui. No new dependencies, no external images or fonts; inline SVG
  or CSS only.
- Deliverable: app/(marketing)/page.tsx, server component, starting with
  `if (await getSession()) redirect("/dashboard")`. Renders inside the marketing
  layout (logo header, footer, max-w-3xl column — widen with your own wrapper).
  Client components only where interaction needs them (the hero panel).
- Responsive from 360 px; real headings, alt text, visible focus, keyboard
  operable tabs (roving tabindex or Radix Tabs if present in components/ui).
  No layout shift. Respect prefers-reduced-motion.

## Process
1. Write the plan for direction A: palette, type roles and scale, layout with
   ASCII wireframes for the hero and one more section, alignment, principles.
2. Review the plan against this document: for each part, ask whether any dark
   SaaS page would have produced the same thing. If yes, change it and say what
   changed and why.
3. Build page.tsx. Screenshot at 1280 px and 400 px, dark and light. Critique:
   is the hero the one memorable thing, is everything else quiet, does it pass
   "remove one accessory"? Fix, re-shoot.
4. Hand over:
   - Rationale, 5–10 lines: the one idea, why it fits, what was avoided.
   - Complete page.tsx + the four screenshots.
   - Design system implied: diff of app/globals.css tokens (add `stage`,
     light-theme amber text token, ink-3 fix, radii/shadow/type-scale
     changes), and a list of components/ui pieces that change (button shape,
     inputs, badges, dialogs, tabs) with one line each. Keep it to what the
     page actually establishes.
