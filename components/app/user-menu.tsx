"use client";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  user,
  username,
}: {
  user: { name: string; email: string; image?: string | null };
  username: string;
}) {
  const router = useRouter();
  const initials = (user.name || user.email).trim().slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-raised py-1 pr-2 pl-1 text-ink transition-colors hover:border-line-strong sm:pr-3"
        >
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-[13px] font-semibold text-accent-text">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <span className="hidden max-w-28 truncate text-[13px] font-medium sm:block">
            {user.name.split(" ")[0] || user.email}
          </span>
          <ChevronDown className="hidden size-4 text-ink-3 sm:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-ink">
          <span className="block truncate font-medium">{user.name}</span>
          <span className="block truncate text-xs font-normal text-ink-3">@{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <User /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings#preferences")}>
          <Settings /> Preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
