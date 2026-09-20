"use client";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type SectionLink = { id: string; label: string; icon: React.ReactNode };

/** Sticky list of the page's sections; the one in view is lit. Horizontal chips on small screens. */
export function SectionNav({ sections }: { sections: SectionLink[] }) {
  const [active, setActive] = React.useState(sections[0]?.id);
  // A click decides for the next second; the smooth scroll it starts must not vote.
  const clickedAt = React.useRef(0);
  React.useEffect(() => {
    // The last section whose top has scrolled past the sticky header is the one being read.
    const update = () => {
      if (Date.now() - clickedAt.current < 1000) return;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 200) current = s.id;
      }
      // At the very bottom the last section can never reach the top; it is still the one in view.
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      setActive(atBottom ? sections[sections.length - 1]!.id : current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [sections]);

  return (
    <nav aria-label="Settings sections" className="lg:sticky lg:top-24 lg:self-start">
      <ul className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:flex-col">
        {sections.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
              onClick={() => {
                clickedAt.current = Date.now();
                setActive(s.id);
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] whitespace-nowrap transition-colors [&_svg]:size-4",
                active === s.id
                  ? "bg-accent-soft text-ink [&_svg]:text-accent-text"
                  : "text-ink-2 hover:bg-raised hover:text-ink [&_svg]:text-ink-3",
              )}
            >
              {s.icon}
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
