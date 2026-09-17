"use client";
import { CopyMenu } from "@/components/app/copy-menu";
import type { CopyPayload } from "@/lib/copy/format";

/** Server pages can't pass functions to CopyMenu; this wrapper takes the payload as data. */
export function CopyPreset({ payload, what }: { payload: CopyPayload; what: string }) {
  return <CopyMenu getPayload={() => payload} what={what} label="Copy" variant="secondary" />;
}
