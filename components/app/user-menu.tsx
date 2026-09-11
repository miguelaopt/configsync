"use client";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";
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
          className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-raised text-[13px] font-semibold text-ink hover:border-line-strong"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="size-full rounded-full object-cover" />
          ) : (
            initials
          )}
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
