# 0001 — Next.js + PostgreSQL + Drizzle, one process

**Status:** accepted · 2026-09-11

## Context

Open-source, self-hostable, must be great on mobile and desktop, must not depend on a proprietary backend.

## Decision

Next.js App Router with Server Actions as the whole backend; PostgreSQL through Drizzle ORM; a single container.

## Consequences

- Self-hosting is `docker compose up`. No separate API, no queue, no object storage.
- Mutations are server actions, so there is no REST surface to keep in sync with the UI. File uploads/downloads use route handlers.
- Supabase was considered; a plain Postgres URL keeps the door open to it (it _is_ Postgres) without requiring it.
