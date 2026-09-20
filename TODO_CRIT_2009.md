# Missing pages — 2026-09-20

Audit of every route on `main` after PR #32. No link on the site points at a page that does
not exist; what is missing is product surface a visitor, a search engine or the Paddle
reviewer would expect. Ordered by impact.

## Public pages that do not exist yet

- [ ] **`/docs/import-export`** — the JSON format is documented in `docs/import-export.md`;
      nothing public explains what an export contains or that it can be re-imported.
- [ ] **`/contact`** — today it is a `mailto:` in the footer. Paddle's reviewers and some
      search engines look for a contact page; can be a short page with the email and the
      legal identity from `lib/legal.ts`.

## Pages that exist but are empty in production

- [x] `/p/miguel` — public profile switched on (2026-09-20). Mark presets as public so it is
      not "No public presets yet".

## Done in PR `feat/changelog` (2026-09-20)

- `/changelog` from `content/changelog.ts`, footer link, sitemap with a real lastmod.

## Done in PR `feat/game-pages` (2026-09-20)

- `/for` and `/for/<game>` (`/for/cs2`, `/for/rocket-league`) from the catalog: every setting
  by name with its config key, the files per launcher, three commands, FAQ (with FAQPage
  schema), in the sitemap; header/footer "Games" and the landing cards link there.
- The Public profile switch saves on toggle.

## Done in PR `feat/seo-design-sweep` (2026-09-20)

- `/docs/companion` — public install guide for `csync` (was only visible inside Settings).
- Root `404` and error pages on the marketing chrome.
- Settings, Export, Search, Compare and Import moved to the panel design.
- Search-engine titles/descriptions with real search terms, fixed sitemap dates,
  `GOOGLE_SITE_VERIFICATION` support, README linking the site.
