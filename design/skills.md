# Design skills and superpowers — how to use them on this repo

The Claude Code setup on this machine has two plugin families that matter for design work.
Invoke a skill by name (`/skill-name` in the prompt, or ask Claude to "use the X skill").

## Design

| Skill | What it is for | Use it when |
| --- | --- | --- |
| `frontend-design` | Distinctive, intentional visual design for new or reshaped UI — aesthetic direction, typography, spacing, avoiding templated defaults. | Building or restyling any page or component: the landing page, pricing, public profile, dialogs. Pair it with `design/landing-page-prompt.md`. |
| `artifact-design` | Design pass for standalone HTML artifacts (pages Claude publishes, not app code). | Mockups, throwaway comparisons, a design exploration you want to look at in the browser before touching the app. |
| `artifact-diagramming` | Diagrams that show the real mechanism, legible in light and dark. | Architecture pictures for docs or a pitch. |
| `dataviz` | Charts and dashboards that read as one system. | Any chart — usage stats, the Paddle numbers, device status over time. |
| `ponytail` (lite/full/ultra) | Forces the laziest solution that works: reuse what exists, no speculative abstractions. | Always on in this project at `lite`. Keeps design changes small: one file, existing tokens and components. |

## Superpowers (process)

| Skill | What it does | Use it when |
| --- | --- | --- |
| `brainstorming` | Turns an idea into a design/spec through questions; classifies work as spike / bounded / architectural. | Before any new feature or a page redesign. It ends with an approval gate — nothing is built until you say yes. |
| `writing-plans` | Turns an approved spec into a bite-sized, testable implementation plan (`docs/superpowers/plans/`). | After an architectural spec. Bounded work (one page) skips the plan document. |
| `executing-plans` / `subagent-driven-development` | Executes a plan task by task with verification between tasks. | Implementing a plan in this session, or with fresh subagents per task. |
| `test-driven-development` | Failing test → minimal code → pass → commit. | Any logic change. UI-only work gets a browser check instead. |
| `systematic-debugging` | Reproduce, isolate, root-cause before fixing. | Any bug or unexpected behaviour. |
| `verification-before-completion` | Run the checks and show the output before claiming "done". | Always, before a PR. |
| `finishing-a-development-branch` | Tests → options (merge / PR / keep) → cleanup. | End of every branch. This repo always picks "push + PR". |
| `using-git-worktrees` | Isolated checkout for a branch. | Rarely needed here; the Docker DB and `.env` live in the main checkout. |
| `requesting-code-review` / `receiving-code-review` | Structured review and how to respond to it. | Before merging bigger PRs; when review feedback is questionable. |
| `writing-skills` | Author new skills. | If a repeated workflow deserves its own skill (e.g. "deploy to Hetzner"). |

## The workflow for the landing page

1. `brainstorming` — paste `design/landing-page-prompt.md`, answer its questions, approve the
   direction. Expect it to classify the page as *bounded* (one file) → short design in chat, no
   spec document.
2. `frontend-design` — Claude writes `app/(marketing)/page.tsx` against the real tokens and
   components. Ask for desktop + 400 px screenshots (Playwright is installed) before accepting.
3. `verification-before-completion` — `pnpm check`, `pnpm format:check`, `pnpm build`.
4. `finishing-a-development-branch` — branch → push → PR → merge → on the server
   `git pull && docker compose --profile app --profile proxy up -d --build`.

## Other tools already available

- **Playwright MCP / `@playwright/test`** — screenshots and click-throughs of local or production
  pages. Chromium is installed; the `chrome` channel is not.
- **context7** — current docs for Next.js 16, Tailwind v4, Radix. Use before relying on memory.
- **Artifacts** — publish an HTML mockup at a private URL to compare directions side by side.
- **Miro** plugin — boards, if a visual conversation about structure helps.

## House rules that apply to design changes

- Dark-first, one accent (`#e9b44c`), Barlow Semi Condensed for display, Geist for body.
- Reuse `components/ui`; no new dependencies; no external images or fonts.
- No "open source / source-available / GitHub" copy on the public site.
- Every page must read correctly in the light theme and at 360 px.
- Prices and feature lists come from `lib/billing/public.ts`; legal links from the layout footer.
