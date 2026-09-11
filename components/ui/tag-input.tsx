"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Chips + text input. Enter or comma adds; Backspace on empty removes the last. */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions = [],
  max = 50,
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const tag = raw.trim().slice(0, 40);
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));
  const remaining = suggestions.filter((s) => !value.includes(s));

  return (
    <div>
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-sm border border-line bg-ground px-1.5 py-1 transition-colors focus-within:border-accent hover:border-line-strong",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-6 items-center gap-1 rounded-xs bg-raised pr-1 pl-2 text-[13px] text-ink"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
              className="flex size-4 cursor-pointer items-center justify-center rounded-xs text-ink-3 hover:bg-overlay hover:text-ink"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={draft}
          placeholder={value.length === 0 ? placeholder : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              remove(value[value.length - 1]!);
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              add(draft);
              setDraft("");
            }
          }}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      {remaining.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {remaining.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="h-6 cursor-pointer rounded-xs border border-dashed border-line px-2 text-xs text-ink-3 hover:border-line-strong hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
