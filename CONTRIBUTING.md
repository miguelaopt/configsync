# Contributing

Thanks for helping. Small, focused pull requests are the easiest to review and merge.

## Setup

Follow the [Quick start](README.md#quick-start). Then:

```bash
pnpm check        # typecheck + lint + unit tests — must pass
pnpm test:e2e     # Playwright; needs Postgres running and browsers installed:
                  #   pnpm exec playwright install chromium
```

## Ground rules

- **Any game.** Never add game-specific columns, enums or UI. Settings are generic (`lib/settings/types.ts`).
- **User-owned data.** Anything that stores user content must be covered by export/import (`lib/import-export/schema.ts`). Add optional fields; never rename or repurpose existing ones.
- **Authorization is server-side.** Every query filters by `user_id`. Every server action goes through `runAction()` (`lib/actions/shared.ts`), which resolves the user before touching data.
- **Validate at the boundary.** Server actions and route handlers parse their input with Zod (`lib/validation`).
- **No fake automation.** Don't imply the app changed anything inside a game.
- **Accessibility.** Keyboard reachable, labelled controls, visible focus, no color-only meaning. Use the primitives in `components/ui`.
- **Errors are for humans.** No raw database codes in the UI. Keep user input on screen when a save fails.

## Workflow

1. Branch from `main`.
2. Schema change? Edit `lib/db/schema.ts`, run `pnpm db:generate`, commit the SQL in `drizzle/`.
3. Add or update tests: unit tests in `tests/`, the end-to-end flow in `e2e/`.
4. `pnpm check` and, for UI changes, `pnpm test:e2e`.
5. Open a PR. Describe _what changed for the user_, not just what changed in the code.

## Commit style

```
feat: add preset comparison
fix: preserve form values on save failure
test: cover preset import
docs: add self-hosting guide
```

## Adding a setting type

1. Add the id to `SETTING_TYPE_IDS` and its metadata to `SETTING_TYPES` in `lib/settings/types.ts`.
2. Add it to the `setting_type` enum in `lib/db/schema.ts` and generate a migration.
3. Render it in `components/settings/setting-control.tsx`.
4. Add a case to `tests/setting-types.test.ts`.

## Adding a game to the catalog

Drop a `catalog/<id>.json` with the game's real menu and its config-file mappings, import it in
`lib/catalog/index.ts`, add trimmed fixtures and a round-trip test. The rules (exact in-game
names, no artwork, `source` shapes) are in [docs/catalog.md](docs/catalog.md).

## Reporting bugs

Open an issue with steps to reproduce, what you expected, what happened, and your browser/OS. For security issues see [SECURITY.md](SECURITY.md) — don't open a public issue.
