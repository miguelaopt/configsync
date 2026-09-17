# GameSettings Vault

Your game settings. One place.

Save, organize, compare, copy and export the settings you use for any game — mouse sensitivity, keybinds, graphics, audio, whatever the game has — in an interface that feels like a game's settings menu, not a spreadsheet. Works on phone and desktop. No game integration required: you type (or paste) the values, the vault keeps them.

- **Any game.** Add a completely custom game; nothing is hard-coded per title.
- **Real menus from the catalog.** Counter-Strike 2 and Rocket League come with their actual settings menus, names and options.
- **Companion CLI.** `gsv` scans your installed games, imports their config files as presets and applies presets back — with backups.
- **Presets.** Multiple setups per game (Main, Competitive, Laptop…). Duplicate, compare, archive, set default.
- **Generic settings.** Toggles, numbers, sliders, dropdowns, keybinds, colors, resolutions and more.
- **Copy anything.** One setting, a category or a whole preset — as plain text, Markdown or JSON.
- **Your data.** Full JSON export/import, plus Markdown and CSV exports. Documented format.
- **Version history.** Every meaningful save keeps a snapshot you can restore.
- **Self-hostable.** One Postgres database, one container. AI features are optional and off by default.

> The web app stores and copies your settings. Only the companion CLI, run by you on your own PC, ever touches a game's files.

## Quick start

Requirements: Node 20.12+, pnpm 12, Docker (for Postgres).

```bash
git clone https://github.com/<you>/gamesettings-vault && cd gamesettings-vault
cp .env.example .env               # set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm install
docker compose up -d db            # Postgres 16 on localhost:5432
pnpm db:migrate                    # apply SQL migrations in ./drizzle
pnpm db:seed                       # optional demo account: demo@example.com / demo-vault-2026
pnpm dev                           # http://localhost:3000
```

## Scripts

| Command            | What it does                                   |
| ------------------ | ---------------------------------------------- |
| `pnpm dev`         | Dev server                                     |
| `pnpm build`       | Production build (standalone output)           |
| `pnpm check`       | Typecheck + lint + unit tests                  |
| `pnpm test:e2e`    | Playwright walk-through (desktop + mobile)     |
| `pnpm db:generate` | Generate a migration from `lib/db/schema.ts`   |
| `pnpm db:migrate`  | Apply migrations                               |
| `pnpm db:seed`     | Create the demo account and import the example |
| `pnpm db:reset`    | Drop everything (development only)             |
| `pnpm db:studio`   | Drizzle Studio                                 |

## Companion

```sh
cd companion && npm i -g .        # or `pnpm gsv …` from this checkout
gsv login http://localhost:3000    # paste a token from Settings → Companion
gsv scan --push                    # installed Steam/Epic games → your vault
gsv import cs2                     # CS2's config files → a new preset
gsv apply cs2 <preset-slug>        # preset → config files (backs up first)
```

Details in [docs/companion.md](docs/companion.md).

## Documentation

- [Self-hosting & deployment](docs/self-hosting.md) — Docker, environment variables, email, OAuth
- [Architecture](docs/architecture/overview.md) — stack, data model, request flow, security
- [Import/export format](docs/import-export.md) — the stable JSON schema
- [Game catalog](docs/catalog.md) — adding a game with its real menu and config-file mappings
- [Companion CLI](docs/companion.md) — scan, import and apply from your gaming PC
- [AI providers](docs/architecture/ai-providers.md) — the optional screenshot assistant
- [Decisions](docs/decisions/) — why things are the way they are
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md)

## Stack

Next.js (App Router, Server Actions) · React · TypeScript strict · Tailwind CSS v4 · Radix primitives · Drizzle ORM · PostgreSQL · better-auth · Zod · Vitest · Playwright · pnpm · Docker.

Every dependency is open source. There is no proprietary backend.

## License

[MIT](LICENSE)
