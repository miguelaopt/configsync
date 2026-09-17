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
          <img src={p.avatarUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
        ) : (
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-display text-2xl"
            aria-hidden
          >
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
                      <span className="shrink-0 text-xs text-ink-3">
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
