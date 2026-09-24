"use client";
import * as React from "react";
import s from "@/app/(landing)/landing.module.css";

/** One lighting scene per section, in page order. Each is a fixed layer; only its opacity moves. */
export const SCENES = [
  "hero",
  "story",
  "windows",
  "app",
  "games",
  "privacy",
  "pricing",
  "final",
] as const;

/**
 * The page's background changes as you scroll: whichever `[data-scene]` section crosses the middle
 * of the viewport lights its scene, and the previous one fades out. One IntersectionObserver, no
 * scroll listener; the layers are fixed, so the change costs an opacity crossfade and nothing else.
 */
export function Scenes() {
  const [active, setActive] = React.useState<string>("hero");
  React.useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.scene ?? "hero");
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    document.querySelectorAll("[data-scene]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div aria-hidden className={s.scenes}>
      {SCENES.map((name) => (
        <div key={name} className={s.scene} data-name={name} data-on={name === active} />
      ))}
    </div>
  );
}
