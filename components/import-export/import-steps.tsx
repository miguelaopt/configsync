import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function ImportSteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Import progress" className="mb-5">
      <ol className="flex items-center gap-3 text-[13px]">
        {["Source", "Review", "Import"].map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className="flex items-center gap-3"
          >
            {index > 0 ? <ChevronRight className="size-3.5 text-ink-3" aria-hidden /> : null}
            <span
              className={cn(
                "flex items-center gap-1.5",
                step === index + 1 ? "font-medium text-ink" : "text-ink-3",
              )}
            >
              {step > index + 1 ? (
                <Check className="size-3.5 text-good" aria-hidden />
              ) : (
                <span>{index + 1}.</span>
              )}
              {label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
