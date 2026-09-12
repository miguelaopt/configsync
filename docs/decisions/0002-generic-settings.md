# 0002 — Generic settings with a typed JSON value

**Status:** accepted · 2026-09-11

## Context

The product must work for any game. Games have wildly different settings; we can't model them as columns.

## Decision

`settings` has a `type` enum and a JSONB `value`. Validation, editing and display are driven by `lib/settings/types.ts`, keyed by type. Constraints (`min`/`max`/`step`/`options`/`unit`) are columns on the setting itself.

## Consequences

- Adding a type is code + one enum migration; no table changes.
- Search over values uses the JSON text; good enough at personal-library scale. A generated `value_text` column is the upgrade path.
- No shared "setting definitions" across users yet; every preset owns its settings. A template/catalog layer can be added on top later.
