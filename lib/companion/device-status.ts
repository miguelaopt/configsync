import type { DeviceApplied } from "@/lib/db/schema";

export type DeviceStatus =
  | { kind: "never" }
  | { kind: "applied"; presetSlug: string; at: string }
  | { kind: "waiting"; presetSlug: string }
  | { kind: "failed"; presetSlug: string; at: string }
  /** The daemon's last write is not what the server wants now; it applies on its next idle tick. */
  | { kind: "stale"; presetSlug: string; at: string };

/** Combines what a device last reported with what the server wants it to have. */
export function deviceStatus(
  applied: DeviceApplied[string] | undefined,
  want: { presetSlug: string; version: string } | null,
): DeviceStatus {
  if (!applied) return { kind: "never" };
  if (applied.status === "failed")
    return { kind: "failed", presetSlug: applied.presetSlug, at: applied.at };
  if (applied.status === "waiting") return { kind: "waiting", presetSlug: applied.presetSlug };
  if (want && (want.presetSlug !== applied.presetSlug || want.version !== applied.version))
    return { kind: "stale", presetSlug: applied.presetSlug, at: applied.at };
  return { kind: "applied", presetSlug: applied.presetSlug, at: applied.at };
}
