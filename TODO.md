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
- [ ] **Prove a refund revokes Pro** — **owner**. Miguel says `adjustment.created` and
      `adjustment.updated` are subscribed; it has never been observed end to end. Buy Monthly with
      a real card, refund it in Paddle, watch the badge drop to Free within seconds and
      `docker compose logs app | grep csync:billing` stay clean. If it does not drop, the two
      events are not really on the destination.
- [ ] **Verify the AI screenshot importer against the real model.** It is sold on `/pricing` and
      has never run with a real key and a real screenshot. Upload a CS2 Video-settings screenshot
      on a preset. If the values come back wrong, tune the prompt in `lib/ai/screenshot.ts` or the
      coercion in `lib/settings/coerce.ts`. A Pro feature that misreads is worse than one that is
      off.

## 2. Getting found

- [~] **Search engines.** Done and live: `robots.txt`, `sitemap.xml`, `metadataBase`, canonical
  URLs, OG and Twitter cards, a real favicon, and schema.org Organization / WebSite /
  SoftwareApplication with the real prices. Left:
  - [ ] **Google Search Console** — **owner**. <https://search.google.com/search-console> → add
        `configsync.app` as a Domain property → it gives a TXT record → add it in Cloudflare DNS →
        Verify → Sitemaps → submit `sitemap.xml` → URL Inspection on `https://configsync.app/` →
        "Request indexing". Indexing takes days, not minutes. (Google retired the old sitemap ping
        endpoint, so this is the only way to hurry it.)
  - [ ] **Bing Webmaster Tools** — **owner**. Same idea, and it can import straight from Search
        Console.
  - [ ] Check the link preview by pasting `https://configsync.app` into a Discord DM and into X's
        compose box. Expect the purple card, not a grey box.
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
- [ ] **Turn on the public profile** — **owner**. `/p/<username>` currently 404s, while the landing
      page sells sharing. Settings → Profile → username + Public profile on, then mark a few
      presets public.

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
- Four screens were rebuilt to Miguel's mockups (dashboard, library, game, preset). The pages that
  were _not_ redesigned — `/import`, `/export`, `/search`, `/settings` — inherit the palette and
  look consistent, but still use flat rows instead of the `.panel` grammar. That is the obvious
  next visual job, and nobody has asked for it yet.
- When a mockup shows something the data cannot support, the answer is a `ComingSoonPanel`, not
  placeholder data. Ask before inventing.
