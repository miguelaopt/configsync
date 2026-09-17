# Public profile — design

**Status:** approved 2026-09-17 · **Builds on:** `main` after PR #3

## Goal

Free users can publish a page with their configs and social links. Visitors read a preset,
copy it, download it, or save it to their own vault (creating an account on the way). Nothing
is public unless the user turns both the profile and the preset on.

## Product decisions

| Decision      | Choice                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Visibility    | Profile switch `isPublic` **and** preset `visibility = "public"`. Both default off.                     |
| URLs          | `/p/<username>` and `/p/<username>/<gameSlug>/<presetSlug>`. Slugs only, never ids.                     |
| Links         | Up to 6 `https://` URLs on the profile; icon chosen from the host.                                      |
| Bio           | Plain text, ≤ 300 characters.                                                                           |
| Hidden fields | Preset `notes` and setting `notes` never appear publicly (personal). `description` does.                |
| Covers        | `coverUrl` covers render; uploaded covers fall back to the initials tile (auth-only route).             |
| Save to vault | Signed in → import the preset into the viewer's account (Free limit applies); else sign-up with `next`. |
| Unlisted      | Not now (`shareToken` stays unused).                                                                    |

## A. Data

`profiles` gains `is_public boolean default false not null`, `bio text null`,
`links jsonb default '[]' not null` (`string[]`). Migration `0003_public_profile`.

`lib/validation`: `profileInputSchema` gains `bio: optionalTrimmed(300)`,
`links: z.array(httpsLink).max(6).default([])` where `httpsLink = z.string().trim().max(200).regex(/^https:\/\/[^\s]+$/, "Links must start with https://")`,
`isPublic: z.boolean().default(false)`.

`lib/data/public.ts` (server-only, **every query filters on `is_public` and `visibility`**):

- `getPublicProfile(username)` → `{ username, displayName, avatarUrl, bio, links, games: { name, slug, coverUrl, accentColor, presets: { name, slug, description, settingCount }[] }[] } | null`
- `getPublicPreset(username, gameSlug, presetSlug)` → `{ profile: { username, displayName }, game: { name, slug, accentColor, coverUrl }, preset: { name, slug, description, tags, updatedAt }, categories: CategoryDoc[] (notes stripped), doc: GameDoc (for download/save) } | null`

Archived games/presets are never public.

## B. Routes (public, `(marketing)` layout)

- `app/(marketing)/p/[username]/page.tsx` — header (avatar or initials, display name, `@username`,
  bio, link icons), then games with their public presets. Metadata: `"<name> · ConfigSync"`,
  description = bio. 404 when the profile is not public or has no username match.
- `app/(marketing)/p/[username]/[gameSlug]/[presetSlug]/page.tsx` — breadcrumb back to the
  profile, preset name, description, tags, "updated <timeAgo>", then one card per category
  with rows `setting name · formatted value (+ unit)`; wide types (text, keybinds) take the full
  row. Actions: `CopyMenu` (existing), "Download JSON" → `/api/public/export?u=…&g=…&p=…`,
  "Save to my vault" (`SaveToVaultButton`).
- `app/api/public/export/route.ts` — no auth; validates the three slugs; 404 unless public;
  returns the export JSON with `Content-Disposition: attachment`.
- `lib/actions/public.ts` → `saveToVaultAction({ username, gameSlug, presetSlug })` — requires a
  session; loads the public doc; `importFile(viewerId, file)` (game matched by name or created;
  preset always new, named as the original); returns `{ url }` of the new preset. Free limit
  errors surface through the existing `toastError`.

`proxy.ts`: `/p` is not in `PROTECTED` — nothing to change. `robots`: nothing to change (no
robots file exists; pages are indexable by default).

## C. Management UI

- Settings → Profile (`profile-form.tsx`): "Public profile" `Switch` with the live URL under it
  (link when on), "Bio" textarea, "Links" — six `Input type="url"` slots shown as a growing list
  (one empty slot after the last filled). Saved by the existing `updateProfileAction`.
- Preset actions menu: "Make public" / "Make private" (`setPresetVisibilityAction`), placed
  after Favorite. Preset header: `Badge variant="good"` "Public" when public, with a tooltip
  showing the URL when the profile is public, or "Turn on your public profile in Settings"
  when it isn't.
- Pricing: FEATURES.free "Public profile with your configs" loses "(coming soon)".

## Errors and safety

- Public data functions are the only readers used by public routes; they never take a userId
  from the request and never return ids.
- Links are rendered with `rel="noopener noreferrer nofollow"`, `target="_blank"`, and only
  when they pass the https regex again at render time.
- Bio and every user string render as text (React escaping); no markdown.
- Username lookups are exact, lowercase (the schema already lowercases on save).
- 404 for private profiles, private presets, archived items, and unknown slugs — same page.

## Testing

- Unit (`tests/public-links.test.ts`): `linkMeta(url)` → `{ label, icon }` for twitch.tv,
  youtube.com/youtu.be, x.com/twitter.com, discord.gg/discord.com, github.com, other; rejects
  non-https via the schema.
- Unit (`tests/validation.test.ts`): `profileInputSchema` accepts 6 https links, rejects 7 and
  `http://`.
- E2E (walkthrough): on "Main Setup": menu → Make public; Settings → Public profile on +
  save; open `/p/<username>` in a fresh context (signed out): preset visible; open it: a known
  setting value visible; a private preset's URL → 404.

## Sequence

1. Schema + validation + `lib/data/public.ts` + unit tests.
2. Public pages + export route + save action.
3. Management UI (profile form, preset menu/badge, pricing copy).
4. E2E, docs (`README` feature bullet, `docs/architecture/overview.md` data model), PR.
