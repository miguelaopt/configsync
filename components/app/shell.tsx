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
  children: React.ReactNode;
};

export function AppShell({ user, username, children }: ShellProps) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-sm focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>

      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-ground/95 px-3 backdrop-blur-sm sm:px-4 lg:pl-4">
        <Link href="/dashboard" className="rounded-sm text-ink" aria-label="ConfigSync home">
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:inline-flex" />
        </Link>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto hidden h-9 w-72 cursor-pointer items-center gap-2 rounded-sm border border-line bg-surface px-3 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2 sm:flex lg:w-80"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search games, presets, settings</span>
          <Kbd>⌘K</Kbd>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto flex size-9 cursor-pointer items-center justify-center rounded-sm text-ink-2 hover:bg-raised sm:hidden"
          aria-label="Search"
        >
          <Search className="size-5" />
        </button>
        <UserMenu user={user} username={username} />
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <nav
          aria-label="Primary"
          className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 flex-col border-r border-line px-2 py-3 lg:flex"
        >
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-[13px] font-medium transition-colors",
                    isActive(href)
                      ? "bg-raised text-ink"
                      : "text-ink-2 hover:bg-surface hover:text-ink",
                  )}
                >
                  <Icon
                    className={cn("size-4", isActive(href) ? "text-accent" : "text-ink-3")}
                    aria-hidden
                  />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-auto px-2.5 text-[11px] leading-relaxed text-ink-3">
            Open source · self-hostable.
            <br />
            Your data is yours to export.
          </p>
        </nav>

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
                <Icon className={cn("size-5", isActive(href) && "text-accent")} aria-hidden />
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
