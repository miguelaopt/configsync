# TODO

Ordered by what actually blocks money and trust. `PROJECT_STATE.md` says what exists;
`PRE-LAUNCH.md` has the click-by-click checks Miguel does himself.

`[ ]` not started · `[~]` partly done · **owner** means only Miguel can do it (an account,
a card, a dashboard login)

---

## 1. Blocking revenue

- [ ] **Paddle domain approval** — **owner**. Rejected twice with the generic "offline / login
      wall" email. Reply asking for a human review: `/`, `/pricing`, `/terms`, `/privacy` and
      `/refunds` are all public 200s now, and pricing matches the Paddle catalogue. No sale can
      happen until this clears.
- [ ] **Prove a refund revokes Pro** — **owner**. `adjustment.created` and `adjustment.updated`
      are on the destination (Miguel, 2026-09-20); it has never been observed end to end. Buy Monthly with
      a real card, refund it in Paddle, watch the badge drop to Free within seconds and
      `docker compose logs app | grep csync:billing` stay clean. If it does not drop, the two
      events are not really on the destination.
- [ ] **Verify the AI screenshot importer against the real model.** It is sold on `/pricing` and
      has never run with a real key and a real screenshot. Upload a CS2 Video-settings screenshot
      on a preset. If the values come back wrong, tune the prompt in `lib/ai/screenshot.ts` or the
      coercion in `lib/settings/coerce.ts`. A Pro feature that misreads is worse than one that is
      off.

## 2. Getting found

- [~] **Search engines.** Done and live: searchable titles and descriptions, `robots.txt`,
  `sitemap.xml` with 12 URLs, canonical URLs, OG and Twitter cards, favicon, schema.org
  Organization / WebSite / SoftwareApplication / FAQPage, per-game pages, the companion guide and
  the changelog. Search Console verified + sitemap submitted, GitHub repo homepage set
  (2026-09-20). Left:
  - [ ] **Bing Webmaster Tools** — **owner**. Import from Search Console; covers DuckDuckGo too.
  - [ ] Check the link preview by pasting `https://configsync.app` into a Discord DM and into X's
        compose box. Expect the purple card, not a grey box.
  - [ ] `/contact` and `/docs/import-export` — the last two pages in `TODO_CRIT_2009.md`.
- [ ] **A reason to link to the site.** Nothing here ranks without inbound links: a post in the
      CS2 / Rocket League config corners of Reddit, a short YouTube walkthrough of `csync watch`,
      or a public profile worth sharing. This is the real SEO work; the tags above only make it
      count.

## 3. Trust and operations

- [ ] **Get the backups off the server** — **owner**, 5 minutes. They live only on the machine
      that holds the database. `PRE-LAUNCH.md` §6 has the `rsync` one-liner and the weekly cron.
- [ ] **Do the restore drill once** — **owner**. `PRE-LAUNCH.md` §7 restores the newest dump into a
      scratch `gsv_drill` database and compares row counts. Safe to run on production. Write down
      how long it took; that is the recovery time.
- [ ] **Test the maintenance page once**: `docker compose stop app`, load the site, bring it back.
- [ ] **Mark a few presets public** — **owner**. The profile is on (2026-09-20); with no public
      presets `/p/miguel-ferreira` says "No public presets yet".

## 4. Product, next

- [ ] **Setting details panel** on the preset page. The mockup has it; the honest version shows the
      setting's name, description and default value, and drops "tip" and "related settings", which
      do not exist. Needs a selected-setting state threaded through `components/settings/preset-editor.tsx`.
- [ ] **Search within a preset** — a client-side filter over the rows, plus a category filter. Small
      and clearly useful on an 81-setting preset.
- [ ] **More catalog games.** `docs/catalog.md`. Every game added is a reason for someone new to
      sign up. Valorant, Apex, Fortnite and Minecraft are the obvious next ones.
- [ ] **Friends, public profiles, pro players** — the three `Coming soon` cards. Needs a real
      design pass first: following, a discovery feed, and what "verified" means.
- [ ] **Desktop tray app** around `csync watch`. Autostart already works, so this is UX sugar.
- [ ] **Offline OCR provider** for self-hosters who do not want images leaving their server —
      the `ScreenshotParser` contract in `lib/providers/screenshot.ts` is the seam.

## 5. Housekeeping

- [ ] `WALKTHROUGH.md` is out of date — it still describes merging PRs #5 and #6.
- [ ] `design/HANDOFF.md` documents the rejected "direction A" landing page. Delete it or mark it
      historical; it contradicts the shipped design.
- [ ] `@fontsource/barlow-semi-condensed` is still a dependency and nothing imports it any more.
- [ ] Decide what `/search` should be now that the library page has its own filter and sort.

---

## Notes for whoever picks this up

- Read `AGENTS.md` first. The rule that catches people out: a client component importing anything
  from `lib/data/*` breaks the build with a confusing Postgres-in-the-browser error.
- Every app page is on the `.panel` grammar now (PR #33). `PageHeader` is the heading for the
  secondary pages; the four main screens have their own headers.
- A user-visible PR bumps `package.json` and adds a `content/changelog.ts` entry — see
  `AGENTS.md` → Releases.
- When a mockup shows something the data cannot support, the answer is a `ComingSoonPanel`, not
  placeholder data. Ask before inventing.
