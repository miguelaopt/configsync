"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Monitor } from "lucide-react";
import { setDevicePresetAction } from "@/lib/actions/companion";
import type { DeviceRow } from "@/lib/data/devices";
import type { DeviceStatus } from "@/lib/companion/device-status";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastError } from "@/components/ui/toaster";
import { timeAgo } from "@/lib/utils/format";

type Props = {
  gameId: string;
  devices: DeviceRow[];
  presets: { id: string; name: string; isDefault: boolean }[];
};

export const PLATFORM_LABEL: Record<string, string> = {
  linux: "Linux",
  win32: "Windows",
  darwin: "macOS",
};
const DEFAULT = "default";

function statusText(s: DeviceStatus) {
  const name = s.kind !== "never" && s.presetSlug ? `${s.presetSlug} · ` : "";
  switch (s.kind) {
    case "never":
      return "never synced";
    case "applied":
      return `${name}applied ${timeAgo(s.at)}`;
    case "waiting":
      return `${name}waiting, game is running`;
    case "failed":
      return `${name}failed ${timeAgo(s.at)} — check the daemon log`;
    case "stale":
      return `${name}applied ${timeAgo(s.at)}, update pending`;
  }
}

/** Which preset each PC runs for this game, and what it last applied. */
export function DevicePresetsCard({ gameId, devices, presets }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const def = presets.find((p) => p.isDefault);

  const change = (device: DeviceRow, value: string) =>
    start(async () => {
      const presetId = value === DEFAULT ? null : value;
      const r = await setDevicePresetAction({ deviceId: device.id, gameId, presetId });
      if (!r.ok) return toastError(r.error);
      const label = presetId
        ? presets.find((p) => p.id === presetId)?.name
        : `Default (${def?.name ?? "none"})`;
      toast.success(`${device.name} will switch to ${label} on its next sync`);
      router.refresh();
    });

  return (
    <section className="mt-8 rounded-sm border border-line p-4">
      <h2 className="flex items-center gap-2 font-display text-lg">
        <Monitor className="size-4 text-ink-3" /> On your PCs
      </h2>
      <p className="mt-1 text-[13px] text-ink-2">
        Each PC running <code className="font-mono text-xs">csync watch</code> applies the preset
        chosen here, or the Default.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {devices.map((d) => (
          <li
            key={d.id}
            className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="truncate font-medium text-ink">{d.name}</span>
                {d.platform ? (
                  <span className="text-ink-3">{PLATFORM_LABEL[d.platform] ?? d.platform}</span>
                ) : null}
                {d.status.kind === "stale" ? <Badge variant="note">Pending</Badge> : null}
                {d.status.kind === "failed" ? <Badge variant="bad">Failed</Badge> : null}
              </div>
              <div className="text-xs text-ink-3">
                {statusText(d.status)} · seen {timeAgo(d.lastSeenAt)}
              </div>
            </div>
            <Select
              value={d.presetId ?? DEFAULT}
              onValueChange={(v) => change(d, v)}
              disabled={pending}
            >
              <SelectTrigger aria-label={`Preset for ${d.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT}>Default{def ? ` (${def.name})` : ""}</SelectItem>
                {presets
                  .filter((p) => !p.isDefault)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </section>
  );
}
