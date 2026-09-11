"use client";
import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";

/** Big search affordance on the dashboard; dispatches the same ⌘K the shell listens for. */
export function SearchTrigger() {
  const open = () =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  return (
    <button
      type="button"
      onClick={open}
      className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-4 text-left text-[15px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
    >
      <Search className="size-5" aria-hidden />
      <span className="flex-1">Find a game, preset or setting</span>
      <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
    </button>
  );
}
