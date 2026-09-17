# Public Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/p/<username>` shows a user's public presets and links; a public preset page lets visitors copy, download or save it to their own vault.

**Architecture:** One server-only module (`lib/data/public.ts`) is the only reader for public routes and always filters on `profiles.is_public` + `presets.visibility = 'public'` + not archived. Pages live under the `(marketing)` layout with no auth. Saving to a vault reuses `importFile`. Management is two switches: profile `isPublic` (Settings) and preset visibility (preset menu).

**Tech Stack:** Next.js 16 App Router, Drizzle, Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-public-profile-design.md`

## Global Constraints

- Public only when profile `isPublic` **and** preset `visibility = "public"`; archived never. Both default off.
- Never expose ids on public pages/URLs; never render preset or setting `notes` publicly.
- Links: `https://` only, ≤ 6, ≤ 200 chars; rendered with `rel="noopener noreferrer nofollow" target="_blank"`. Bio ≤ 300 chars, plain text.
- 404 for private/unknown — one page, no distinction.
- `pnpm check` before every commit; attribution line from the session reminder on commits.
- Branch: `feat/public-profile` (off `main`).

---

## File map

| Path                                                                                  | Responsibility                                                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `lib/db/schema.ts`, `drizzle/0003_public_profile.sql`                                 | `profiles.is_public`, `bio`, `links`                                  |
| `lib/validation/index.ts`                                                             | `profileInputSchema` + `httpsLink`                                    |
| `lib/public/links.ts`                                                                 | `linkMeta(url)` → icon + label (pure, client-safe)                    |
| `lib/data/public.ts`                                                                  | `getPublicProfile`, `getPublicPreset`                                 |
| `lib/actions/profile.ts`, `lib/actions/presets.ts`, `lib/actions/public.ts`           | save profile fields; `setPresetVisibilityAction`; `saveToVaultAction` |
| `app/(marketing)/p/[username]/page.tsx`, `…/[gameSlug]/[presetSlug]/page.tsx`         | Public pages                                                          |
| `app/api/public/export/route.ts`                                                      | Public JSON download                                                  |
| `components/public/profile-links.tsx`, `preset-table.tsx`, `save-to-vault-button.tsx` | Public UI pieces                                                      |
| `components/settings-page/profile-form.tsx`                                           | Public switch, bio, links                                             |
| `components/presets/preset-actions.tsx`, `preset-header.tsx`                          | Make public/private, Public badge                                     |
| `lib/billing/public.ts`                                                               | Copy                                                                  |
| `tests/public-links.test.ts`, `tests/validation.test.ts`, `e2e/vault.spec.ts`         | Tests                                                                 |

---

## Task 1: Data — schema, validation, links meta, public queries

**Files:**

- Modify: `lib/db/schema.ts` (`profiles`), `lib/validation/index.ts`, `lib/actions/profile.ts`, `tests/validation.test.ts`
- Create: `drizzle/0003_public_profile.sql` (generated), `lib/public/links.ts`, `lib/data/public.ts`, `tests/public-links.test.ts`

**Interfaces:**

- Produces:
  - `profiles.isPublic: boolean`, `bio: string | null`, `links: string[]`.
  - `profileInputSchema` output gains `isPublic: boolean`, `bio: string | null | undefined`, `links: string[]`.
  - `linkMeta(url: string): { icon: "twitch" | "youtube" | "x" | "discord" | "github" | "globe"; label: string }`.
  - `PublicProfile = { username; displayName: string | null; avatarUrl: string | null; bio: string | null; links: string[]; games: { name; slug; coverUrl: string | null; accentColor: string | null; presets: { name; slug; description: string | null; settingCount: number }[] }[] }`.
  - `PublicPreset = { profile: { username; displayName }; game: { name; slug; accentColor; coverUrl }; preset: { name; slug; description; tags: string[]; updatedAt: Date }; categories: CategoryDoc[]; doc: GameDoc }`.
  - `getPublicProfile(username): Promise<PublicProfile | null>`; `getPublicPreset(username, gameSlug, presetSlug): Promise<PublicPreset | null>`.

- [ ] **Step 1: Failing tests**

`tests/public-links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { linkMeta } from "@/lib/public/links";

describe("linkMeta", () => {
  it("picks an icon and label from the host", () => {
    expect(linkMeta("https://www.twitch.tv/someone")).toEqual({ icon: "twitch", label: "Twitch" });
    expect(linkMeta("https://youtube.com/@someone")).toEqual({ icon: "youtube", label: "YouTube" });
    expect(linkMeta("https://youtu.be/abc")).toEqual({ icon: "youtube", label: "YouTube" });
    expect(linkMeta("https://x.com/someone")).toEqual({ icon: "x", label: "X" });
    expect(linkMeta("https://twitter.com/someone")).toEqual({ icon: "x", label: "X" });
    expect(linkMeta("https://discord.gg/abc")).toEqual({ icon: "discord", label: "Discord" });
    expect(linkMeta("https://github.com/someone")).toEqual({ icon: "github", label: "GitHub" });
    expect(linkMeta("https://someone.dev/")).toEqual({ icon: "globe", label: "someone.dev" });
  });
  it("falls back to globe for junk", () => {
    expect(linkMeta("not a url")).toEqual({ icon: "globe", label: "not a url" });
  });
});
```

Append to `tests/validation.test.ts` (check its existing imports; add `profileInputSchema`):

```ts
describe("profileInputSchema public fields", () => {
  const base = { username: "someone", displayName: "Some One" };
  it("accepts six https links, a bio and the switch", () => {
    const links = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`);
    const r = profileInputSchema.safeParse({ ...base, isPublic: true, bio: "hi", links });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.links).toHaveLength(6);
  });
  it("rejects a seventh link and http://", () => {
    const seven = Array.from({ length: 7 }, (_, i) => `https://example.com/${i}`);
    expect(profileInputSchema.safeParse({ ...base, links: seven }).success).toBe(false);
    expect(profileInputSchema.safeParse({ ...base, links: ["http://x.com"] }).success).toBe(false);
  });
  it("defaults to private with no links", () => {
    const r = profileInputSchema.safeParse(base);
    expect(r.success && r.data.isPublic).toBe(false);
    expect(r.success && r.data.links).toEqual([]);
  });
});
```

Run `pnpm vitest run tests/public-links.test.ts tests/validation.test.ts` → FAIL.

- [ ] **Step 2: `lib/public/links.ts`**

```ts
export type LinkIcon = "twitch" | "youtube" | "x" | "discord" | "github" | "globe";

const HOSTS: [RegExp, LinkIcon, string][] = [
  [/(^|\.)twitch\.tv$/, "twitch", "Twitch"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube", "YouTube"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x", "X"],
  [/(^|\.)(discord\.gg|discord\.com)$/, "discord", "Discord"],
  [/(^|\.)github\.com$/, "github", "GitHub"],
];

/** Which icon and label to show for a profile link. Anything unknown is "globe" + its host. */
export function linkMeta(url: string): { icon: LinkIcon; label: string } {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { icon: "globe", label: url };
  }
  for (const [re, icon, label] of HOSTS) if (re.test(host)) return { icon, label };
  return { icon: "globe", label: host.replace(/^www\./, "") };
}
```

- [ ] **Step 3: Validation** — in `lib/validation/index.ts`:

```ts
const httpsLink = z
  .string()
  .trim()
  .max(200, "Links are too long (max 200)")
  .regex(/^https:\/\/\S+$/, "Links must start with https://");

export const profileInputSchema = z.object({
  username: …unchanged…,
  displayName: optionalTrimmed(80),
  isPublic: z.boolean().default(false),
  bio: optionalTrimmed(300),
  links: z.array(httpsLink).max(6, "Up to 6 links").default([]),
});
```

- [ ] **Step 4: Schema + migration** — `profiles` gains, after `avatarUrl`:

```ts
    /** Public page at /p/<username>. Off by default; presets also need visibility = public. */
    isPublic: boolean("is_public").default(false).notNull(),
    bio: text("bio"),
    links: jsonb("links").$type<string[]>().default([]).notNull(),
```

`pnpm db:generate` → rename to `drizzle/0003_public_profile.sql` + journal tag; `pnpm db:migrate`. Expected SQL: three `ALTER TABLE "profiles" ADD COLUMN …`.

- [ ] **Step 5: Save the fields** — `lib/actions/profile.ts` `updateProfileAction` set: `{ username, displayName: v.displayName ?? null, isPublic: v.isPublic, bio: v.bio ?? null, links: v.links }`.

- [ ] **Step 6: `lib/data/public.ts`**

```ts
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { toCategoryDocs, type PresetFull } from "./presets";
import type { CategoryDoc, GameDoc } from "@/lib/import-export/schema";

const { profiles, games, presets, categories, settings } = schema;

export type PublicProfile = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  links: string[];
  games: {
    name: string;
    slug: string;
    coverUrl: string | null;
    accentColor: string | null;
    presets: { name: string; slug: string; description: string | null; settingCount: number }[];
  }[];
};

/** Profile + every public preset, grouped by game. Null unless the profile is public. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.username, username.toLowerCase()), eq(profiles.isPublic, true)),
  });
  if (!profile) return null;
  const rows = await db
    .select({
      gameName: games.name,
      gameSlug: games.slug,
      coverUrl: games.coverUrl,
      accentColor: games.accentColor,
      presetName: presets.name,
      presetSlug: presets.slug,
      description: presets.description,
      presetId: presets.id,
    })
    .from(presets)
    .innerJoin(games, eq(games.id, presets.gameId))
    .where(
      and(
        eq(presets.userId, profile.userId),
        eq(presets.visibility, "public"),
        eq(presets.isArchived, false),
        eq(games.isArchived, false),
      ),
    )
    .orderBy(asc(games.name), asc(presets.name));
  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const countRows = await db
      .select({ presetId: categories.presetId, n: settings.id })
      .from(settings)
      .innerJoin(categories, eq(categories.id, settings.categoryId))
      .where(
        inArray(
          categories.presetId,
          rows.map((r) => r.presetId),
        ),
      );
    for (const r of countRows) counts.set(r.presetId, (counts.get(r.presetId) ?? 0) + 1);
  }
  const byGame = new Map<string, PublicProfile["games"][number]>();
  for (const r of rows) {
    let g = byGame.get(r.gameSlug);
    if (!g)
      byGame.set(
        r.gameSlug,
        (g = {
          name: r.gameName,
          slug: r.gameSlug,
          coverUrl: r.coverUrl,
          accentColor: r.accentColor,
          presets: [],
        }),
      );
    g.presets.push({
      name: r.presetName,
      slug: r.presetSlug,
      description: r.description,
      settingCount: counts.get(r.presetId) ?? 0,
    });
  }
  return {
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    links: profile.links.filter((l) => /^https:\/\/\S+$/.test(l)),
    games: [...byGame.values()],
  };
}

export type PublicPreset = {
  profile: { username: string; displayName: string | null };
  game: { name: string; slug: string; accentColor: string | null; coverUrl: string | null };
  preset: {
    name: string;
    slug: string;
    description: string | null;
    tags: string[];
    updatedAt: Date;
  };
  categories: CategoryDoc[];
  doc: GameDoc;
};

/** One public preset with its settings. Notes are stripped: they are personal. */
export async function getPublicPreset(
  username: string,
  gameSlug: string,
  presetSlug: string,
): Promise<PublicPreset | null> {
  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.username, username.toLowerCase()), eq(profiles.isPublic, true)),
  });
  if (!profile) return null;
  const game = await db.query.games.findFirst({
    where: and(
      eq(games.userId, profile.userId),
      eq(games.slug, gameSlug),
      eq(games.isArchived, false),
    ),
  });
  if (!game) return null;
  const preset = await db.query.presets.findFirst({
    where: and(
      eq(presets.gameId, game.id),
      eq(presets.slug, presetSlug),
      eq(presets.visibility, "public"),
      eq(presets.isArchived, false),
    ),
    with: {
      categories: {
        orderBy: [asc(categories.position), asc(categories.createdAt)],
        with: { settings: { orderBy: [asc(settings.position), asc(settings.createdAt)] } },
      },
    },
  });
  if (!preset) return null;
  const cats = toCategoryDocs((preset as PresetFull).categories).map((c) => ({
    ...c,
    settings: c.settings.map((s) => ({ ...s, notes: null })),
  }));
  const doc: GameDoc = {
    name: game.name,
    platforms: game.platforms,
    tags: game.tags,
    accentColor: game.accentColor,
    coverUrl: game.coverUrl,
    notes: null,
    catalogId: game.catalogId,
    presets: [
      {
        name: preset.name,
        description: preset.description,
        notes: null,
        tags: preset.tags,
        isDefault: false,
        categories: cats,
      },
    ],
  };
  return {
    profile: { username: profile.username, displayName: profile.displayName },
    game: {
      name: game.name,
      slug: game.slug,
      accentColor: game.accentColor,
      coverUrl: game.coverUrl,
    },
    preset: {
      name: preset.name,
      slug: preset.slug,
      description: preset.description,
      tags: preset.tags,
      updatedAt: preset.updatedAt,
    },
    categories: cats,
    doc,
  };
}
```

(add `inArray` to the drizzle import). Check `CategoryDoc`/`PresetDoc` field names against `lib/import-export/schema.ts` (`notes`, `isDefault`, `tags`, `description`) before relying on them.

- [ ] **Step 7: Verify** — tests PASS; `pnpm check` PASS.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(public): profile visibility, bio and links; public profile queries"`

---

## Task 2: Public pages, export route, save-to-vault

**Files:**

- Create: `app/(marketing)/p/[username]/page.tsx`, `app/(marketing)/p/[username]/[gameSlug]/[presetSlug]/page.tsx`, `app/api/public/export/route.ts`, `lib/actions/public.ts`, `components/public/profile-links.tsx`, `components/public/preset-table.tsx`, `components/public/save-to-vault-button.tsx`

**Interfaces:**

- Consumes: `getPublicProfile`, `getPublicPreset`, `linkMeta`, `GameCover`, `CopyMenu`, `formatValue`, `isWideControl`, `timeAgo`, `importFile`, `buildExportFile`, `getSession`.
- Produces: `saveToVaultAction({ username, gameSlug, presetSlug })` → `{ url: string }`.

- [ ] **Step 1: `components/public/profile-links.tsx`**

```tsx
import { Github, Globe, MessageCircle, Twitch, Youtube } from "lucide-react";
import { linkMeta, type LinkIcon } from "@/lib/public/links";

const ICONS: Record<LinkIcon, React.ComponentType<{ className?: string }>> = {
  twitch: Twitch,
  youtube: Youtube,
  x: XIcon,
  discord: MessageCircle,
  github: Github,
  globe: Globe,
};

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.9 2H22l-7.4 8.5L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.9-9L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" />
    </svg>
  );
}

export function ProfileLinks({ links }: { links: string[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((url) => {
        const { icon, label } = linkMeta(url);
        const Icon = ICONS[icon];
        return (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line px-2.5 text-[13px] text-ink-2 hover:border-line-strong hover:text-ink"
            >
              <Icon className="size-4" /> {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

(Check `lucide-react` exports `Twitch`, `Youtube`, `Github`, `Globe`, `MessageCircle` — `grep -c "Twitch\b" node_modules/lucide-react/dist/lucide-react.d.ts`; if `Twitch`/`Youtube` are missing in this version, use `Tv` and `Video`.)

- [ ] **Step 2: `components/public/preset-table.tsx`** (server component, read-only)

```tsx
import type { CategoryDoc } from "@/lib/import-export/schema";
import { formatValue, type SettingValue } from "@/lib/settings/types";
import { isWideControl } from "@/components/settings/setting-control";

/** Read-only view of a preset: one card per category, name · value rows. */
export function PresetTable({ categories }: { categories: CategoryDoc[] }) {
  if (categories.length === 0)
    return <p className="text-[13px] text-ink-3">This preset has no settings yet.</p>;
  return (
    <div className="flex flex-col gap-4">
      {categories.map((c) => (
        <section
          key={c.name}
          className="rounded-md border border-line bg-surface"
          aria-labelledby={`cat-${c.name}`}
        >
          <h2
            id={`cat-${c.name}`}
            className="border-b border-hairline px-4 py-2.5 font-display text-[15px]"
          >
            {c.name}
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2">
            {c.settings.map((s) => {
              const wide = isWideControl(s.type);
              const value = formatValue(s, s.value as SettingValue | null);
              return (
                <div
                  key={s.name}
                  className={`flex items-baseline justify-between gap-4 border-b border-hairline px-4 py-2 last:border-b-0 ${wide ? "sm:col-span-2" : ""}`}
                >
                  <dt className="text-[13px] text-ink-2">{s.name}</dt>
                  <dd className="text-right font-mono text-[13px] text-ink">
                    {value || "—"}
                    {s.unit && value ? <span className="ml-1 text-ink-3">{s.unit}</span> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
```

`isWideControl` lives in a `"use client"` file — importing a plain function from a client module into a server component is fine in Next (it's just a module), but to be safe move `isWideControl` to `lib/settings/types.ts` if the build complains.

- [ ] **Step 3: `lib/actions/public.ts` + `components/public/save-to-vault-button.tsx`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPublicPreset } from "@/lib/data/public";
import { importFile } from "@/lib/data/import";
import { AppError } from "@/lib/data/errors";
import { runAction } from "./shared";

const slug = z.string().min(1).max(120);
const input = z.object({ username: slug, gameSlug: slug, presetSlug: slug });

/** Copies a public preset into the signed-in user's vault as a new preset. */
export async function saveToVaultAction(raw: unknown) {
  return runAction(input, raw, async (v, userId) => {
    const pub = await getPublicPreset(v.username, v.gameSlug, v.presetSlug);
    if (!pub) throw new AppError("That preset isn't public any more.", "not_found");
    const outcome = await importFile(userId, {
      format: "gamesettings-vault",
      version: 1,
      kind: "preset",
      games: [pub.doc],
    });
    revalidatePath("/", "layout");
    const game = outcome.createdGames[0]?.slug ?? (await gameSlugByName(userId, pub.doc.name));
    return { url: `/games/${game}/${outcome.createdPresetSlugs[0]}` };
  });
}
```

`gameSlugByName(userId, name)` = `uniqueSlug(name, [])` looked up via `getGameBySlug` (import both); since `importFile` matches by that same slug, this returns the existing game's slug.

```tsx
"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toastError } from "@/components/ui/toaster";
import { saveToVaultAction } from "@/lib/actions/public";

type Props = { username: string; gameSlug: string; presetSlug: string; signedIn: boolean };

export function SaveToVaultButton({ username, gameSlug, presetSlug, signedIn }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  if (!signedIn) {
    const next = encodeURIComponent(`/p/${username}/${gameSlug}/${presetSlug}`);
    return (
      <Button asChild variant="primary">
        <Link href={`/sign-up?next=${next}`}>Save to my vault</Link>
      </Button>
    );
  }
  return (
    <Button
      variant="primary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await saveToVaultAction({ username, gameSlug, presetSlug });
          if (!r.ok) return void toastError(r.error);
          toast.success("Saved to your vault");
          router.push(r.data.url);
        })
      }
    >
      Save to my vault
    </Button>
  );
}
```

- [ ] **Step 4: Export route** — `app/api/public/export/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicPreset } from "@/lib/data/public";
import { buildExportFile, toJson } from "@/lib/import-export/serialize";
import { slugify } from "@/lib/utils/slug";

const q = z.object({
  u: z.string().min(1).max(32),
  g: z.string().min(1).max(120),
  p: z.string().min(1).max(120),
});

/** JSON download of a public preset: /api/public/export?u=<username>&g=<game>&p=<preset> */
export async function GET(req: Request) {
  const parsed = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return new NextResponse(null, { status: 404 });
  const pub = await getPublicPreset(parsed.data.u, parsed.data.g, parsed.data.p);
  if (!pub) return new NextResponse(null, { status: 404 });
  const file = buildExportFile([pub.doc], "preset");
  return new NextResponse(toJson(file), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="configsync-${slugify(pub.game.name)}-${pub.preset.slug}.json"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
```

Check `toJson`/`buildExportFile` signatures in `lib/import-export/serialize.ts` and `slugify` in `lib/utils/slug.ts` (the private export route uses the same).

- [ ] **Step 5: Pages**

`app/(marketing)/p/[username]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/data/public";
import { GameCover } from "@/components/games/game-cover";
import { ProfileLinks } from "@/components/public/profile-links";
import { plural } from "@/lib/utils/format";
import type { Params } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Params<"username">;
}): Promise<Metadata> {
  const p = await getPublicProfile((await params).username);
  return p
    ? {
        title: `${p.displayName ?? p.username} · ConfigSync`,
        description: p.bio ?? `Game settings shared by ${p.username}`,
      }
    : { title: "Profile" };
}

export default async function PublicProfilePage({ params }: { params: Params<"username"> }) {
  const p = await getPublicProfile((await params).username);
  if (!p) notFound();
  const initials = (p.displayName ?? p.username).trim().slice(0, 1).toUpperCase();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full border border-line bg-raised font-display text-2xl">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl">{p.displayName ?? p.username}</h1>
          <p className="text-[13px] text-ink-3">@{p.username}</p>
          {p.bio ? <p className="mt-2 max-w-prose text-[13px] text-ink-2">{p.bio}</p> : null}
          <div className="mt-3">
            <ProfileLinks links={p.links} />
          </div>
        </div>
      </header>
      {p.games.length === 0 ? (
        <p className="text-[13px] text-ink-3">No public presets yet.</p>
      ) : (
        p.games.map((g) => (
          <section key={g.slug} aria-labelledby={`g-${g.slug}`} className="flex gap-4">
            <GameCover
              game={{
                name: g.name,
                accentColor: g.accentColor,
                coverAttachmentId: null,
                coverUrl: g.coverUrl,
              }}
              className="w-20"
            />
            <div className="min-w-0 flex-1">
              <h2 id={`g-${g.slug}`} className="font-display text-lg">
                {g.name}
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {g.presets.map((pr) => (
                  <li key={pr.slug}>
                    <Link
                      href={`/p/${p.username}/${g.slug}/${pr.slug}`}
                      className="flex items-baseline justify-between gap-3 rounded-sm border border-line bg-surface px-3 py-2 hover:border-line-strong"
                    >
                      <span className="text-ink">{pr.name}</span>
                      <span className="text-xs text-ink-3">
                        {plural(pr.settingCount, "setting")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))
      )}
      <p className="text-xs text-ink-3">
        Shared with{" "}
        <Link href="/" className="underline underline-offset-4">
          ConfigSync
        </Link>{" "}
        — keep your own game settings in one place.
      </p>
    </div>
  );
}
```

`app/(marketing)/p/[username]/[gameSlug]/[presetSlug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getPublicPreset } from "@/lib/data/public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyMenu } from "@/components/app/copy-menu";
import { PresetTable } from "@/components/public/preset-table";
import { SaveToVaultButton } from "@/components/public/save-to-vault-button";
import { timeAgo } from "@/lib/utils/format";
import type { Params } from "@/lib/types";

type P = Params<"username" | "gameSlug" | "presetSlug">;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { username, gameSlug, presetSlug } = await params;
  const pub = await getPublicPreset(username, gameSlug, presetSlug);
  return pub
    ? {
        title: `${pub.preset.name} · ${pub.game.name} · ConfigSync`,
        description:
          pub.preset.description ?? `${pub.game.name} settings shared by ${pub.profile.username}`,
      }
    : { title: "Preset" };
}

export default async function PublicPresetPage({ params }: { params: P }) {
  const { username, gameSlug, presetSlug } = await params;
  const [pub, session] = await Promise.all([
    getPublicPreset(username, gameSlug, presetSlug),
    getSession(),
  ]);
  if (!pub) notFound();
  const settingCount = pub.categories.reduce((n, c) => n + c.settings.length, 0);
  const dl = `/api/public/export?u=${encodeURIComponent(username)}&g=${encodeURIComponent(gameSlug)}&p=${encodeURIComponent(presetSlug)}`;
  return (
    <div
      className="flex flex-col gap-6"
      style={{ "--accent": pub.game.accentColor ?? undefined } as React.CSSProperties}
    >
      <nav className="text-[13px] text-ink-3">
        <Link href={`/p/${pub.profile.username}`} className="hover:text-ink">
          {pub.profile.displayName ?? pub.profile.username}
        </Link>
        {" › "}
        {pub.game.name}
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight">{pub.preset.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
            {pub.preset.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
            <span className="text-ink-3">updated {timeAgo(pub.preset.updatedAt)}</span>
          </div>
          {pub.preset.description ? (
            <p className="mt-2 max-w-prose text-[13px] text-ink-2">{pub.preset.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {settingCount > 0 ? (
            <CopyMenu
              getPayload={() => ({
                title: `${pub.game.name} — ${pub.preset.name}`,
                categories: pub.categories,
              })}
              what={`${settingCount} settings`}
              label="Copy"
              variant="secondary"
            />
          ) : null}
          <Button asChild variant="secondary">
            <a href={dl}>
              <Download /> JSON
            </a>
          </Button>
          <SaveToVaultButton
            username={pub.profile.username}
            gameSlug={pub.game.slug}
            presetSlug={pub.preset.slug}
            signedIn={Boolean(session)}
          />
        </div>
      </header>
      <PresetTable categories={pub.categories} />
    </div>
  );
}
```

`CopyMenu` is a client component; passing `getPayload` (a function) from a server component is not allowed. Instead render a tiny client wrapper `components/public/copy-preset.tsx` that receives `{ title, categories }` as props and renders `CopyMenu` with `getPayload={() => payload}`.

- [ ] **Step 6: Verify** — `pnpm check` PASS. Dev: make demo's profile public + one CS2 preset public via SQL (`update profiles set is_public=true where …; update presets set visibility='public' where slug='cli-check' …`), visit `/p/demo…` signed out: profile renders, preset link, preset page with values, JSON download works, "Save to my vault" → sign-up link; signed in as a second account → saves and lands on the copy. Private preset URL → 404. Reset the SQL afterwards (the e2e in Task 4 covers it for real).

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(public): profile and preset pages, JSON download, save to vault"`

---

## Task 3: Management UI

**Files:**

- Modify: `components/settings-page/profile-form.tsx`, `lib/actions/presets.ts`, `lib/data/presets.ts` (`setPresetFlags` type), `components/presets/preset-actions.tsx`, `components/presets/preset-header.tsx`, `lib/billing/public.ts`

- [ ] **Step 1: Profile form** — state: `isPublic`, `bio`, `links: string[]` (from `profile.links`). Submit sends them. UI after Username:

```tsx
<Field label="Public profile" htmlFor="is-public" hint={isPublic ? `Live at ${origin}/p/${username}` : "Off — nobody can see your presets, even public ones."}>
  <div className="flex h-9 items-center"><Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} /></div>
</Field>
<Field label="Bio" htmlFor="bio" optional error={errors.bio}>
  <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} />
</Field>
<Field label="Links" htmlFor="link-0" optional hint="https:// links to Twitch, YouTube, X, Discord, your site… up to 6." error={errors.links ?? errors["links.0"]}>
  <div className="flex flex-col gap-2">
    {[...links, ""].slice(0, 6).map((l, i) => (
      <Input key={i} id={`link-${i}`} type="url" value={l} placeholder="https://twitch.tv/you" onChange={(e) => { const next = [...links]; next[i] = e.target.value; setLinks(next.filter((x, j) => x.trim() !== "" || j < next.length - 1)); }} />
    ))}
  </div>
</Field>
```

Submit: `links: links.map((l) => l.trim()).filter(Boolean)`. `origin` = `typeof window !== "undefined" ? window.location.origin : ""` computed inside an effect-free way: use `process.env.NEXT_PUBLIC_APP_URL ?? ""`.

- [ ] **Step 2: Visibility action** — `lib/data/presets.ts` `setPresetFlags` type → `Partial<Pick<schema.Preset, "isFavorite" | "isArchived" | "visibility">>`. `lib/actions/presets.ts`:

```ts
export async function setPresetVisibilityAction(presetId: string, value: boolean) {
  return runAction(flagSchema, { presetId, value }, async (v, userId) => {
    await data.setPresetFlags(userId, v.presetId, { visibility: v.value ? "public" : "private" });
    revalidatePath("/", "layout");
    return null;
  });
}
```

- [ ] **Step 3: Menu + badge** — `preset-actions.tsx` after the Favorite item:

```tsx
<DropdownMenuItem
  onSelect={() =>
    run(
      setPresetVisibilityAction(preset.id, preset.visibility !== "public"),
      preset.visibility === "public" ? "Preset is private again" : "Preset is public",
    )
  }
>
  {preset.visibility === "public" ? <EyeOff /> : <Globe />}{" "}
  {preset.visibility === "public" ? "Make private" : "Make public"}
</DropdownMenuItem>
```

`preset-header.tsx`: `PresetHeader` gets `publicUrl?: string | null` (the preset page computes it: profile public ? `/p/${username}/${game.slug}/${preset.slug}` : null) and shows after Default: `{preset.visibility === "public" ? <Tooltip content={publicUrl ? publicUrl : "Turn on your public profile in Settings to share this"}><Badge variant="good">Public</Badge></Tooltip> : null}`. The preset page already loads `profile` → pass `publicUrl`.

- [ ] **Step 4: Copy** — `lib/billing/public.ts` free: `"Public profile with your configs and links"`.

- [ ] **Step 5: Verify + commit** — `pnpm check` PASS; manual: toggle public on a preset → badge; Settings → public on → badge tooltip shows the URL; visit it signed out. `git commit -m "feat(public): public switch, bio and links in Settings; make preset public/private"`

---

## Task 4: E2E, docs, PR

**Files:**

- Modify: `e2e/vault.spec.ts`, `README.md`, `docs/architecture/overview.md`

- [ ] **Step 1: E2E** — after the "Set default / favorite" area (find the step that edits "Main Setup"; place before "Archive + delete"):

```ts
// --- Public profile -----------------------------------------------------
await page.goto("/games/test-arena/main-setup");
await page.getByRole("button", { name: /^Actions for Main Setup/ }).click();
await page.getByRole("menuitem", { name: "Make public" }).click();
await expect(page.getByText("Preset is public")).toBeVisible();
await page.goto("/settings");
const username = await page.getByLabel("Username").inputValue();
await page.getByLabel("Public profile").click();
await page.getByLabel("Bio").fill("Settings I actually use.");
await page.getByLabel("Links").fill("https://twitch.tv/e2e-player");
await page.getByRole("button", { name: "Save profile" }).click();
await expect(page.getByText("Profile saved")).toBeVisible();
const anon = await context.browser()!.newContext();
const pub = await anon.newPage();
await pub.goto(`/p/${username}`);
await expect(pub.getByRole("heading", { name: "E2E Player" })).toBeVisible();
await expect(pub.getByRole("link", { name: "Twitch" })).toBeVisible();
await pub.getByRole("link", { name: "Main Setup" }).click();
await expect(pub.getByRole("heading", { name: "Main Setup" })).toBeVisible();
await expect(pub.getByText("Sensitivity")).toBeVisible();
const privateRes = await pub.goto(`/p/${username}/test-arena/main-setup-copy`);
expect(privateRes?.status()).toBe(404);
await anon.close();
```

Adjust the slugs/names to what the walkthrough actually creates (read the spec file: the duplicated preset's slug, the setting names it adds). The `Links` label targets the first link input via `htmlFor="link-0"`.

- [ ] **Step 2: Docs** — README feature bullet: "**Public profile.** Share your presets at `/p/<username>` with your Twitch/YouTube links; visitors copy, download or save them to their own vault." `docs/architecture/overview.md`: `profiles (… is_public, bio, links)` in the data model; one paragraph "## Public pages" — `lib/data/public.ts` is the only reader, filters, notes stripped, no ids.

- [ ] **Step 3: Verify** — `pnpm check`, prettier, `pnpm test:e2e` PASS.

- [ ] **Step 4: Commit + PR** — `git commit -m "test(e2e): public profile walkthrough; docs"`, push, `gh pr create --base main …`.

---

## Self-review notes

- Spec A → Task 1; B → Task 2; C → Task 3; testing → Tasks 1, 4.
- Names: `getPublicProfile`, `getPublicPreset`, `PublicProfile`, `PublicPreset` (1, 2); `linkMeta`, `LinkIcon` (1, 2); `saveToVaultAction` (2); `setPresetVisibilityAction` (3); `profileInputSchema` fields `isPublic`, `bio`, `links` (1, 3).
- Known corner: a game whose cover is an upload shows the monogram publicly (auth-only attachment route) — noted in the spec.
