import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getPublicPreset } from "@/lib/data/public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyPreset } from "@/components/public/copy-preset";
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
  const q = new URLSearchParams({ u: pub.profile.username, g: pub.game.slug, p: pub.preset.slug });
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
            <CopyPreset
              payload={{
                title: `${pub.game.name} — ${pub.preset.name}`,
                categories: pub.categories,
              }}
              what={`${settingCount} settings`}
            />
          ) : null}
          <Button asChild variant="secondary">
            <a href={`/api/public/export?${q}`}>
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
