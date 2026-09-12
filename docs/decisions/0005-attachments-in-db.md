# 0005 — Cover images stored in Postgres

**Status:** accepted · 2026-09-11

## Context

Game covers are the only user uploads. Object storage (S3, R2, Supabase Storage) would add a service to configure and a place for data to be left behind on backup/restore.

## Decision

Store covers as `bytea` in an `attachments` table (≤2 MB, type sniffed), served via `/api/attachments/:id` with an ownership check.

## Consequences

- `pg_dump` is a complete backup.
- Fine at personal-library scale; if uploads grow (screenshots for the AI assistant), swap `lib/data/attachments.ts` for an object-storage backend behind the same functions.
