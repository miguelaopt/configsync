"use client";
import * as React from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import {
  COPY_FORMATS,
  COPY_FORMAT_LABELS,
  formatForCopy,
  type CopyFormat,
  type CopyPayload,
} from "@/lib/copy/format";
import { copyWithToast } from "@/lib/copy/use-copy";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

type CopyMenuProps = {
  /** Built lazily so large presets aren't formatted until needed. */
  getPayload: () => CopyPayload;
  defaultFormat?: CopyFormat;
  /** e.g. "12 settings" — used in the confirmation toast. */
  what: string;
  label?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

/** Split button: click copies in the preferred format, the chevron offers the others. */
export function CopyMenu({
  getPayload,
  defaultFormat = "plain",
  what,
  label = "Copy",
  size = "md",
  variant = "secondary",
  className,
}: CopyMenuProps) {
  const [done, setDone] = React.useState(false);
  const copy = async (format: CopyFormat) => {
    const ok = await copyWithToast(
      formatForCopy(getPayload(), format),
      `Copied ${what} as ${COPY_FORMAT_LABELS[format].toLowerCase()}`,
    );
    if (ok) {
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    }
  };
  return (
    <div className={cn("inline-flex", className)}>
      <Button
        variant={variant}
        size={size}
        onClick={() => copy(defaultFormat)}
        className="rounded-r-none"
        aria-label={`${label} as ${COPY_FORMAT_LABELS[defaultFormat]}`}
      >
        {done ? <Check className="text-good" /> : <Copy />}
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className="w-8 rounded-l-none border-l-0 px-0"
            aria-label="Choose copy format"
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Copy as</DropdownMenuLabel>
          {COPY_FORMATS.map((f) => (
            <DropdownMenuItem key={f} onSelect={() => copy(f)}>
              {COPY_FORMAT_LABELS[f]}
              {f === defaultFormat ? (
                <span className="ml-auto text-xs text-ink-3">default</span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
