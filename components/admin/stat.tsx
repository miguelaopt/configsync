import { cn } from "@/lib/utils/cn";

/** One number with its label and an optional line of context. */
export function Stat({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel flex flex-col gap-1 p-4 sm:p-5", className)}>
      <span className="text-[13px] text-ink-3">{label}</span>
      <span className="tnum text-[28px] leading-tight font-semibold text-ink">{value}</span>
      {detail ? <span className="text-[12px] text-ink-3">{detail}</span> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}
