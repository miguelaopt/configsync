import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/** Previous / next links that keep the other query params. */
export function Pager({
  page,
  total,
  size,
  href,
}: {
  page: number;
  total: number;
  size: number;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages === 1) return null;
  const link = (p: number, label: React.ReactNode, aria: string) =>
    p < 1 || p > pages ? (
      <span
        aria-disabled
        className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "opacity-40")}
      >
        {label}
      </span>
    ) : (
      <Link
        href={href(p)}
        aria-label={aria}
        className={buttonVariants({ size: "sm", variant: "ghost" })}
      >
        {label}
      </Link>
    );
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-[13px] text-ink-3">
      {link(page - 1, <ChevronLeft />, "Previous page")}
      <span className="tnum">
        {page} / {pages}
      </span>
      {link(page + 1, <ChevronRight />, "Next page")}
    </nav>
  );
}

export const pageParam = (v: unknown) => {
  const n = Number(typeof v === "string" ? v : 1);
  return Number.isInteger(n) && n > 0 ? n : 1;
};
