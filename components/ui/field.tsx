import * as React from "react";
import { cn } from "@/lib/utils/cn";

type FieldProps = {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + hint/error. Every form control in the app goes through this. */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between text-[13px] font-medium text-ink"
      >
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-ink-3">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
