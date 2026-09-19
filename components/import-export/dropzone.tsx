"use client";
import * as React from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The one place a file enters the app. Quiet until you drag something over it, then it lights
 * up — no dashed border doing the heavy lifting for the whole page.
 */
export function Dropzone({
  accept,
  hint,
  label,
  multiple = false,
  onFiles,
  children,
}: {
  accept: string;
  /** The technical line under the label — file types, where they come from. */
  hint: string;
  label: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  /** The button, so the caller decides its wording. */
  children?: React.ReactNode;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        "flex w-full max-w-[660px] flex-col items-center gap-3 rounded-2xl border px-6 py-10 text-center transition-colors",
        over
          ? "border-[rgb(145_132_217/0.65)] bg-[rgb(145_132_217/0.06)] shadow-[inset_0_0_40px_rgb(145_132_217/0.04),0_0_30px_rgb(100_75_255/0.06)]"
          : "border-[rgb(145_132_217/0.16)] bg-[#171d31] hover:border-[rgb(145_132_217/0.4)]",
      )}
    >
      <Upload className="size-6 text-accent-text" aria-hidden />
      <p className="text-[15px] font-medium text-ink">{label}</p>
      <p className="text-[13px] text-ink-3">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="mt-1" onClick={() => inputRef.current?.click()}>
        {children}
      </span>
    </div>
  );
}
