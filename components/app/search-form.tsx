"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(
      () =>
        router.replace(value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : "/search"),
      250,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.replace(value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : "/search");
      }}
      className="relative w-full max-w-lg"
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search your vault"
        aria-label="Search"
        autoFocus
        className="h-11 pl-9 text-[15px]"
      />
    </form>
  );
}
