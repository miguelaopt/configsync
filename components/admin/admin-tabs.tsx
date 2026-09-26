"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/system", label: "System" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav aria-label="Admin" className="no-scrollbar -mx-1 mb-6 overflow-x-auto px-1">
      <ul className="inline-flex gap-1 rounded-lg border border-line bg-ground p-1">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active(t.href) ? "page" : undefined}
              className={cn(
                "flex h-8 items-center rounded-md px-3 text-[13px] whitespace-nowrap transition-colors",
                active(t.href)
                  ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]"
                  : "text-ink-2 hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
