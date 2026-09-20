import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3", className)}>
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <ol className="flex items-center gap-1 text-[13px] whitespace-nowrap text-ink-3">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
                {c.href ? (
                  <Link href={c.href} className="rounded-xs hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink-2">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-brand w-fit text-[34px] leading-none font-bold sm:text-[40px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2.5 max-w-prose text-[15px] text-ink-2">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Page({
  className,
  children,
  size = "lg",
}: {
  className?: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-5 sm:px-6 sm:py-8 lg:px-8",
        size === "md" && "max-w-2xl",
        size === "lg" && "max-w-5xl",
        // xl fills the window: the app screens are built as a wide column plus a rail.
        size === "xl" && "max-w-[1760px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-baseline justify-between gap-3", className)}>
      <h2 className="font-display text-[17px] text-ink">{children}</h2>
      {action}
    </div>
  );
}
