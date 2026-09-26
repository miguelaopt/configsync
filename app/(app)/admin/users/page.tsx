import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { listAdminUsers, ADMIN_PAGE_SIZE, type AdminUserFilter } from "@/lib/data/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { Pager, pageParam } from "@/components/admin/pager";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Users" };

const FILTERS: { id: AdminUserFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "pro", label: "Pro" },
  { id: "free", label: "Free" },
  { id: "unverified", label: "Email not verified" },
  { id: "banned", label: "Suspended" },
  { id: "admin", label: "Admins" },
];

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const filter = FILTERS.some((f) => f.id === params.filter)
    ? (params.filter as AdminUserFilter)
    : "all";
  const page = pageParam(params.page);
  const { total, rows } = await listAdminUsers({ q, filter, page });
  const href = (p: number) => `/admin/users?${new URLSearchParams({ q, filter, page: String(p) })}`;

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-center gap-2" action="/admin/users">
        <div className="relative w-full sm:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Email, name or username"
            aria-label="Search accounts"
            className={cn(inputClass, "pl-8")}
          />
        </div>
        <select
          name="filter"
          defaultValue={filter}
          aria-label="Show"
          className={cn(inputClass, "w-48")}
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Apply
        </Button>
        <span className="ml-auto text-[13px] text-ink-3">
          {total.toLocaleString("en")} accounts
        </span>
      </form>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead className="border-b border-line text-ink-3">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Games</th>
              <th className="px-4 py-3 font-medium">PCs</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-raised/50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="flex flex-col rounded-sm hover:text-accent-text"
                  >
                    <span className="flex items-center gap-2 font-medium text-ink">
                      {u.name}
                      {u.role === "admin" ? <Badge variant="accent">Admin</Badge> : null}
                      {u.banned ? <Badge variant="bad">Suspended</Badge> : null}
                      {!u.emailVerified ? <Badge variant="outline">Unverified</Badge> : null}
                    </span>
                    <span className="text-ink-3">
                      {u.email}
                      {u.username ? ` · @${u.username}` : ""}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  {u.plan === "pro" ? (
                    <Badge variant="good">
                      Pro ·{" "}
                      {u.planSource === "subscription"
                        ? (u.subscriptionStatus ?? "monthly")
                        : u.planSource === "lifetime"
                          ? "lifetime"
                          : "granted"}
                    </Badge>
                  ) : (
                    <Badge>Free</Badge>
                  )}
                </td>
                <td className="tnum px-4 py-2.5 text-ink-2">{u.games}</td>
                <td className="tnum px-4 py-2.5 text-ink-2">{u.devices}</td>
                <td className="px-4 py-2.5 text-ink-2">{timeAgo(u.createdAt)}</td>
                <td className="px-4 py-2.5 text-ink-2">
                  {u.lastActive ? timeAgo(u.lastActive) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
                  No account matches.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} size={ADMIN_PAGE_SIZE} href={href} />
    </div>
  );
}
