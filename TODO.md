# Import remodel

- [x] Inspect the existing implementation, clean diff and recent commits.
- [x] Keep Claude's page structure, dropzone and backup importer.
- [x] Add visible progress, real game-config review, conflict comparisons and individual choices.
- [x] Add recent imports with truthful browser-local persistence.
- [x] Fix filename matching, recognised counts and replacement of default presets.
- [x] Update import/export documentation and add regression coverage.
- [x] Complete typecheck, lint, unit and desktop/mobile browser tests.
- [x] Inspect desktop/mobile screenshots and complete the final diff review.
- [x] Complete the production build.

Validation: `pnpm check` passes (96 unit tests); the full `pnpm test:e2e` suite passes (8 tests). After the final mobile action-bar adjustment, `pnpm test:e2e e2e/import.spec.ts` passes again (4 tests). `pnpm build` passes outside the sandbox (the sandboxed compile stalled). Changed files pass Prettier and `git diff --check`. Browser screenshots are generated under the ignored `test-results/` directory.

Scope notes: game config support comes from the catalog (currently CS2 and Rocket League). The recent-import list is local to the current browser/account. Broader launch tasks remain in `PRE-LAUNCH.md`.
