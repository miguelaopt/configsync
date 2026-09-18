"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Header link to the opposite auth page, carrying `?next=` along. */
export function AuthSwitchLink() {
  const path = usePathname();
  const params = useSearchParams();
  const next = params.get("next");
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const toSignUp = path !== "/sign-up";
  return (
    <Link
      href={`${toSignUp ? "/sign-up" : "/sign-in"}${q}`}
      className="rounded-sm px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-white/[0.07] hover:text-ink"
    >
      {toSignUp ? "Create a free account" : "Sign in"}
    </Link>
  );
}
