import * as React from "react";
import { cn } from "@/lib/utils/cn";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

/** An empty screen is an invitation to act: say what goes here and offer the action. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-line px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-ink-3 [&_svg]:size-7">{icon}</div> : null}
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[13px] text-ink-2">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
