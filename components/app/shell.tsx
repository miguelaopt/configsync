"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Gamepad2, LayoutDashboard, Search, Settings, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Logo } from "./logo";
import { Kbd } from "@/components/ui/kbd";
import { CommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";
import { SITE } from "@/lib/site";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/export", label: "Export", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

type ShellProps = {
  user: { name: string; email: string; image?: string | null };
  username: string;
  /** null when billing is off (self-host) — no badge either way. */
  plan?: "free" | "pro" | null;
  children: React.ReactNode;
};

export function AppShell({ user, username, plan, children }: ShellProps) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>

      {/* Rail */}
      <nav
        aria-label="Primary"
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-stage lg:flex"
      >
        <Link
          href="/dashboard"
          className="flex h-16 shrink-0 items-center rounded-sm px-5 text-ink"
          aria-label="ConfigSync home"
        >
          <Logo size={28} className="text-[19px]" />
        </Link>
        <ul className="flex flex-col gap-1 px-3 py-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-accent-soft text-ink before:absolute before:top-2.5 before:bottom-2.5 before:-left-3 before:w-[3px] before:rounded-r-sm before:bg-accent"
                    : "text-ink-2 hover:bg-surface hover:text-ink",
                )}
              >
                <Icon
                  className={cn("size-[18px]", isActive(href) ? "text-accent-text" : "text-ink-3")}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="relative mt-auto overflow-hidden px-5 py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgb(145 132 217 / 0.22), rgb(145 132 217 / 0.05) 55%, transparent 78%)",
            }}
          />
          <p className="relative text-[11px] text-ink-3">ConfigSync v{SITE.version}</p>
          <p className="relative text-[11px] text-ink-3">Play better. Everywhere.</p>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-ground/95 px-4 backdrop-blur-sm sm:px-6">
          <Link
            href="/dashboard"
            className="rounded-sm text-ink lg:hidden"
            aria-label="ConfigSync home"
          >
            <Logo compact size={26} />
          </Link>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto hidden h-11 w-80 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-4 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:flex xl:w-[420px]"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Search games, presets, settings…</span>
            <Kbd>⌘K</Kbd>
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex size-10 cursor-pointer items-center justify-center rounded-lg text-ink-2 hover:bg-raised sm:hidden"
            aria-label="Search"
          >
            <Search className="size-5" />
          </button>
          {plan === "pro" ? (
            <span className="hidden h-7 items-center rounded-lg bg-accent-soft px-3 text-xs font-semibold text-accent-text sm:inline-flex">
              Pro
            </span>
          ) : null}
          <span aria-hidden className="hidden h-6 w-px bg-line sm:block" />
          <UserMenu user={user} username={username} />
        </header>

        <main id="main" className="min-w-0 flex-1 pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ground/95 backdrop-blur-sm lg:hidden"
      >
        <ul className="flex h-14 items-stretch">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  isActive(href) ? "text-ink" : "text-ink-3",
                )}
              >
                <Icon className={cn("size-5", isActive(href) && "text-accent-text")} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
