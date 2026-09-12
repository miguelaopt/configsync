# 0003 — One interchange document for export, import and history

**Status:** accepted · 2026-09-11

## Context

Users must be able to take all their data out; we also want version history and, later, sharing and sync.

## Decision

A single Zod-defined document (`lib/import-export/schema.ts`) is used for JSON export, import, revision snapshots, and the diff in Compare. Markdown and CSV exports are projections of it.

## Consequences

- One schema to keep backwards compatible; one parser to fuzz.
- Restore-from-history is literally "import this snapshot".
- Public sharing and offline sync can reuse the same document.
