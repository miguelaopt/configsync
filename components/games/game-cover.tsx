import { cn } from "@/lib/utils/cn";
import type { Game } from "@/lib/db/schema";

type CoverGame = Pick<Game, "name" | "accentColor" | "coverAttachmentId" | "coverUrl">;

export function coverSrc(game: CoverGame) {
  if (game.coverAttachmentId) return `/api/attachments/${game.coverAttachmentId}`;
  return game.coverUrl ?? null;
}

/**
 * Cover art if the user supplied it; otherwise a monogram tile in the game's accent.
 * Looks intentional without any artwork, which is the common case.
 */
export function GameCover({
  game,
  className,
  ratio = "square",
}: {
  game: CoverGame;
  className?: string;
  ratio?: "square" | "wide";
}) {
  const src = coverSrc(game);
  const accent = game.accentColor ?? "var(--accent)";
  const initials = game.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-sm bg-raised",
        ratio === "square" ? "aspect-square" : "aspect-[16/7]",
        className,
      )}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="flex size-full items-center justify-center" aria-hidden>
          <div className="absolute inset-0 opacity-[0.16]" style={{ background: accent }} />
          <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: accent }} />
          <span
            className="relative font-display text-[clamp(1rem,40cqw,2.5rem)] leading-none font-semibold"
            style={{ color: accent }}
          >
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}
