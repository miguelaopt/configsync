import { createHash } from "node:crypto";
import type { PresetDoc } from "./schema";

/** Sorts object keys so semantically equal documents hash equal. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  return v;
}

/** Short content hash of a preset; changes when any value, setting or category changes. */
export function presetFingerprint(doc: PresetDoc): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(doc)))
    .digest("hex")
    .slice(0, 16);
}
