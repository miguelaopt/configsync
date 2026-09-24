import type { CSSProperties } from "react";
import s from "@/app/(landing)/landing.module.css";

/**
 * A value whose digits roll to their new position, like a mechanical counter. Pure CSS: each digit
 * is a 0–9 column moved with transform, so the change is interruptible and off the main thread.
 * `delay` staggers one value after another; digits inside a value also step 30 ms apart.
 */
export function Odometer({ value, delay = 0 }: { value: string; delay?: number }) {
  const chars = [...value];
  return (
    <span className={s.odo}>
      <span className={s.sr}>{value}</span>
      {chars.map((c, i) => {
        // Keyed from the right, so "720" → "1080" keeps its units column in place.
        const key = chars.length - i;
        if (!/\d/.test(c))
          return (
            <span key={`c${key}`} aria-hidden>
              {c}
            </span>
          );
        const style = {
          transform: `translateY(${-Number(c) * 10}%)`,
          transitionDelay: `${delay + (chars.length - i) * 30}ms`,
        } as CSSProperties;
        return (
          <span key={`d${key}`} className={s.odoCell} aria-hidden>
            <span className={s.odoCol} style={style}>
              {"0123456789".split("").map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
