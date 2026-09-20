<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Releases and the version number

`package.json` `version` is the only version. `next.config.ts` bakes it into
`NEXT_PUBLIC_APP_VERSION`; `SITE.version` (sidebar, Settings) and `/changelog` read it. Never
write a version string anywhere else.

Every PR that changes what a user can see or do ships as a release:

1. Bump `package.json` — semver, still `0.x`:
   - **minor** (`0.4.0 → 0.5.0`) for something new: a page, a feature, a game in the catalog, a
     redesign.
   - **patch** (`0.4.0 → 0.4.1`) for fixes, copy, polish, SEO and dependency bumps.
   - `1.0.0` is a decision for the owner, not a side effect.
2. Add an entry at the top of `content/changelog.ts` with the same `version` and the deploy date,
   written for the user (what they can now do), tagged `new` / `improved` / `fixed`.
3. Several PRs deployed the same day share one entry and one bump.

`companion/package.json` has its own version. Bump it only when `companion/` changes, and say so
in the changelog entry (`csync 0.2.0`).

Nothing to write for refactors, tests, docs or CI-only changes.
