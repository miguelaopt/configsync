import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2, Globe, Monitor, Sparkles } from "lucide-react";
import { getAdminUsage } from "@/lib/data/admin";
import { getCatalogGame } from "@/lib/catalog";
import { Panel } from "@/components/dashboard/panels";
import { Stat, StatGrid } from "@/components/admin/stat";
import { DayBars } from "@/components/admin/day-bars";
import { HidePresetButton } from "@/components/admin/hide-preset-button";
import { timeAgo } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Usage" };

const PLATFORM: Record<string, string> = { win32: "Windows", linux: "Linux", darwin: "macOS" };

export default async function AdminUsagePage() {
  const u = await getAdminUsage();
  const totalGames = u.catalog.reduce((n, c) => n + c.games, 0) + u.custom.games;

  return (
    <div className="flex flex-col gap-6">
      <StatGrid>
        <Stat
          label="Games in libraries"
          value={totalGames.toLocaleString("en")}
          detail={`${u.custom.games} outside the catalog`}
        />
        <Stat
          label="Presets"
          value={u.presets.presets.toLocaleString("en")}
          detail={`${u.presets.public} public · ${u.presets.snapshots.toLocaleString("en")} snapshots`}
        />
        <Stat
          label="PCs seen this week"
          value={u.devices.seen7.toLocaleString("en")}
          detail={`${u.devices.seen1} today · ${u.devices.total} ever`}
        />
        <Stat
          label="Companion tokens"
          value={u.tokens.tokens.toLocaleString("en")}
          detail={`${u.tokens.used7} used this week`}
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          icon={<Gamepad2 />}
          title="Games"
          subtitle="Catalog games by how many accounts have them"
        >
          <ul className="flex flex-col">
            {u.catalog.map((c) => (
              <li
                key={c.catalogId}
                className="flex items-baseline justify-between border-b border-line py-2 text-[13px] last:border-0"
              >
                <span className="text-ink">
                  {getCatalogGame(c.catalogId!)?.name ?? c.catalogId}
                </span>
                <span className="tnum text-ink-2">
                  {c.users} {c.users === 1 ? "account" : "accounts"}
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between py-2 text-[13px]">
              <span className="text-ink-3">Games outside the catalog</span>
              <span className="tnum text-ink-2">
                {u.custom.games} in {u.custom.users} {u.custom.users === 1 ? "account" : "accounts"}
              </span>
            </li>
          </ul>
        </Panel>

        <Panel
          icon={<Monitor />}
          title="Companion"
          subtitle="PCs by system, and what the last sync did per game"
        >
          <dl className="grid grid-cols-2 gap-x-6">
            {u.devices.platforms.map(([p, n]) => (
              <div
                key={p}
                className="flex items-baseline justify-between border-b border-line py-2 text-[13px]"
              >
                <dt className="text-ink-3">{PLATFORM[p] ?? p}</dt>
                <dd className="tnum text-ink-2">{n}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-b border-line py-2 text-[13px]">
              <dt className="text-ink-3">Applied</dt>
              <dd className="tnum text-ink-2">{u.devices.applyStatus.applied}</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-line py-2 text-[13px]">
              <dt className="text-ink-3">Waiting for the game to close</dt>
              <dd className="tnum text-ink-2">{u.devices.applyStatus.waiting}</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-line py-2 text-[13px]">
              <dt className="text-ink-3">Failing</dt>
              <dd className="tnum text-ink-2">{u.devices.applyStatus.failed}</dd>
            </div>
          </dl>
          <div className="mt-5">
            <DayBars days={u.devices.newPerDay} label="New PCs per day" unit="new PCs" />
          </div>
        </Panel>

        <Panel
          icon={<Sparkles />}
          title="Screenshot import"
          subtitle="Screenshots read per day, last 30 days"
        >
          <DayBars days={u.ai.days} label="Screenshots read per day" unit="screenshots" />
          {u.ai.models.length > 0 ? (
            <table className="mt-5 w-full text-left text-[13px]">
              <thead className="text-ink-3">
                <tr>
                  <th className="py-1.5 font-medium">Model</th>
                  <th className="py-1.5 font-medium">Screenshots</th>
                  <th className="py-1.5 font-medium">Accounts</th>
                  <th className="py-1.5 font-medium">Tokens in / out</th>
                </tr>
              </thead>
              <tbody>
                {u.ai.models.map((m) => (
                  <tr key={m.model} className="border-t border-line">
                    <td className="py-1.5 text-ink">{m.model}</td>
                    <td className="tnum py-1.5 text-ink-2">{m.requests}</td>
                    <td className="tnum py-1.5 text-ink-2">{m.users}</td>
                    <td className="tnum py-1.5 text-ink-2">
                      {m.inputTokens.toLocaleString("en")} / {m.outputTokens.toLocaleString("en")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Panel>

        <Panel
          icon={<Globe />}
          title="Public presets"
          subtitle="Newest first; make one private to take it down"
        >
          {u.publicPresets.length === 0 ? (
            <p className="text-[13px] text-ink-3">No public presets.</p>
          ) : (
            <ul className="flex flex-col">
              {u.publicPresets.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[13px] last:border-0"
                >
                  <span className="min-w-0 truncate">
                    {p.profilePublic && p.username ? (
                      <Link
                        href={`/p/${p.username}/${p.gameSlug}/${p.slug}`}
                        className="text-ink hover:text-accent-text"
                      >
                        {p.name}
                      </Link>
                    ) : (
                      <span className="text-ink">{p.name}</span>
                    )}
                    <span className="text-ink-3">
                      {" "}
                      · {p.game} ·{" "}
                      <Link href={`/admin/users/${p.userId}`} className="hover:text-ink">
                        {p.email}
                      </Link>{" "}
                      · {timeAgo(p.updatedAt)}
                      {!p.profilePublic ? " · profile private" : ""}
                    </span>
                  </span>
                  <HidePresetButton presetId={p.id} name={p.name} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
