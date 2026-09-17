# 0006 — Source-available license and a paid hosted plan

**Status:** accepted · 2026-09-17

## Context

ConfigSync is built by one person and will be offered as a hosted service with a Free plan and a
paid Pro plan (monthly or lifetime). Under MIT anyone could take the code and run a competing
paid service. At the same time the code should stay readable, forkable and self-hostable for
personal use — that is part of the product's trust story.

## Decision

- License the whole repository under **FSL-1.1-MIT** (Functional Source License). Anyone may
  use, modify and self-host it for their own purposes; offering it as a competing commercial
  service is not permitted. Each version converts to MIT two years after its release.
- Plans are enforced **only by the hosted server**. `PADDLE_*` unset ⇒ every user is Pro.
  Self-hosters get everything; the hosted convenience is what is sold.
- Paddle (merchant of record) handles payment, EU VAT and invoices. The server stores no card
  data and only the Paddle customer/subscription ids needed to map webhooks to users.

## Consequences

- README and footers say "source-available", not "open source".
- Feature gates live in `lib/billing/plan.ts` and the data layer, never in the client.
- Contributors' changes are licensed under the same terms (CONTRIBUTING).
