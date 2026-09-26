import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CreditCard,
  Gamepad2,
  History,
  KeyRound,
  Monitor,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminUser } from "@/lib/data/admin";
import { formatMoney } from "@/lib/admin/metrics";
import { Panel } from "@/components/dashboard/panels";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "@/components/admin/user-actions";
import { AuditList } from "@/components/admin/audit-list";
import { timeAgo } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Account" };

const dateTime = (d: Date | null | undefined) =>
  d
    ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) +
      " UTC"
    : "—";

/** The first browser/OS pair out of a user agent, enough to tell sessions apart. */
function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[13px] last:border-0">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink-2">{children}</dd>
    </div>
  );
}

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [me, d] = await Promise.all([requireAdmin(), getAdminUser(userId)]);
  if (!d) notFound();
  const { user, profile, planRow } = d;
  const now = new Date();
  const liveSessions = d.sessions.filter((s) => s.expiresAt > now);
  const eur = d.revenue[0];

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-[13px] text-ink-3">
        <Link href="/admin/users" className="hover:text-ink">
          Users
        </Link>{" "}
        › {user.email}
      </nav>

      <section className="panel flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[22px] font-semibold text-ink">{user.name}</h2>
          {d.plan === "pro" ? <Badge variant="good">Pro</Badge> : <Badge>Free</Badge>}
          {user.role === "admin" ? <Badge variant="accent">Admin</Badge> : null}
          {user.banned ? (
            <Badge variant="bad">
              Suspended{user.banExpires ? ` until ${dateTime(user.banExpires)}` : ""}
            </Badge>
          ) : null}
          {!user.emailVerified ? <Badge variant="outline">Email not verified</Badge> : null}
        </div>
        <p className="text-[13px] text-ink-3">
          {user.email}
          {profile ? (
            <>
              {" "}
              · @{profile.username}{" "}
              {profile.isPublic ? (
                <Link href={`/p/${profile.username}`} className="text-accent-text hover:underline">
                  public profile
                </Link>
              ) : (
                "(profile private)"
              )}
            </>
          ) : null}
        </p>
        {user.banned && user.banReason ? (
          <p className="text-[13px] text-bad">Suspended: {user.banReason}</p>
        ) : null}
        <UserActions
          user={{
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.role === "admin",
            isSelf: user.id === me.id,
            banned: Boolean(user.banned),
            emailVerified: user.emailVerified,
            plan: d.plan,
            planSource: planRow?.source ?? null,
            sessions: liveSessions.length,
            tokens: d.tokens.length,
          }}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel icon={<UserRound />} title="Account">
          <dl>
            <Row label="Joined">{dateTime(user.createdAt)}</Row>
            <Row label="Sign-in">
              {d.accounts
                .map((a) => (a.providerId === "credential" ? "email + password" : a.providerId))
                .join(", ") || "—"}
            </Row>
            <Row label="Last session">
              {d.sessions[0] ? timeAgo(d.sessions[0].updatedAt) : "never"}
            </Row>
            <Row label="Last companion">
              {d.devices[0] ? timeAgo(d.devices[0].lastSeenAt) : "never"}
            </Row>
            <Row label="Games found on its PCs">{d.installedGames}</Row>
            <Row label="User id">
              <code className="text-[12px]">{user.id}</code>
            </Row>
          </dl>
        </Panel>

        <Panel icon={<CreditCard />} title="Plan and payments">
          <dl>
            <Row label="Plan">{d.plan === "pro" ? "Pro" : "Free"}</Row>
            <Row label="Source">{planRow?.source ?? "—"}</Row>
            <Row label="Subscription">{planRow?.subscriptionStatus ?? "—"}</Row>
            <Row label="Period ends">{dateTime(planRow?.currentPeriodEnd)}</Row>
            <Row label="Paddle customer">
              {planRow?.paddleCustomerId ? (
                <code className="text-[12px]">{planRow.paddleCustomerId}</code>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Paid">
              {eur
                ? `${formatMoney(eur.gross, eur.currency)} in ${eur.sales} ${eur.sales === 1 ? "sale" : "sales"}${eur.refunded ? ` · ${formatMoney(eur.refunded, eur.currency)} refunded` : ""}`
                : "nothing"}
            </Row>
          </dl>
        </Panel>

        <Panel icon={<Sparkles />} title="Screenshot import" subtitle="Last 30 days">
          <dl>
            <Row label="Screenshots">{d.ai.requests}</Row>
            <Row label="Tokens in / out">
              <span className="tnum">
                {d.ai.inputTokens.toLocaleString("en")} / {d.ai.outputTokens.toLocaleString("en")}
              </span>
            </Row>
          </dl>
        </Panel>

        <Panel
          icon={<ShieldCheck />}
          title="Sessions"
          subtitle={`${liveSessions.length} active`}
          bodyClassName="px-4 pb-4 sm:px-5"
        >
          {liveSessions.length === 0 ? (
            <p className="text-[13px] text-ink-3">No active session.</p>
          ) : (
            <ul className="flex flex-col">
              {liveSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13px] last:border-0"
                >
                  <span className="min-w-0 truncate text-ink-2">
                    {device(s.userAgent)}
                    {s.impersonatedBy ? (
                      <Badge variant="note" className="ml-2">
                        admin view
                      </Badge>
                    ) : null}
                    <span className="block text-[12px] text-ink-3">{s.ipAddress ?? "no IP"}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-3">{timeAgo(s.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={<Monitor />} title="PCs" subtitle={`${d.devices.length} with the companion`}>
          {d.devices.length === 0 ? (
            <p className="text-[13px] text-ink-3">The companion has never reported in.</p>
          ) : (
            <ul className="flex flex-col">
              {d.devices.map((pc) => {
                const applied = Object.entries(pc.applied ?? {});
                const failed = applied.filter(([, a]) => a.status === "failed").length;
                return (
                  <li
                    key={pc.id}
                    className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13px] last:border-0"
                  >
                    <span className="min-w-0 truncate text-ink-2">
                      {pc.name} <span className="text-ink-3">· {pc.platform ?? "?"}</span>
                      <span className="block text-[12px] text-ink-3">
                        {applied.length} games applied{failed ? ` · ${failed} failing` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-3">
                      {timeAgo(pc.lastSeenAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel icon={<KeyRound />} title="Companion tokens" subtitle={`${d.tokens.length} issued`}>
          {d.tokens.length === 0 ? (
            <p className="text-[13px] text-ink-3">None.</p>
          ) : (
            <ul className="flex flex-col">
              {d.tokens.map((t) => (
                <li
                  key={t.id}
                  className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13px] last:border-0"
                >
                  <span className="min-w-0 truncate text-ink-2">{t.name}</span>
                  <span className="shrink-0 text-[12px] text-ink-3">
                    {t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : "never used"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        icon={<Gamepad2 />}
        title="Games"
        subtitle={`${d.games.length} in the library`}
        bodyClassName="px-0 pb-2"
      >
        {d.games.length === 0 ? (
          <p className="px-5 pb-3 text-[13px] text-ink-3">No games yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="border-b border-line text-ink-3">
                <tr>
                  <th className="px-5 py-2 font-medium">Game</th>
                  <th className="px-5 py-2 font-medium">Presets</th>
                  <th className="px-5 py-2 font-medium">Public</th>
                  <th className="px-5 py-2 font-medium">Snapshots</th>
                  <th className="px-5 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {d.games.map((g) => (
                  <tr key={g.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2 text-ink">
                      {g.name} {g.catalogId ? <Badge variant="outline">catalog</Badge> : null}{" "}
                      {g.isArchived ? <Badge>archived</Badge> : null}
                    </td>
                    <td className="tnum px-5 py-2 text-ink-2">{g.presets}</td>
                    <td className="tnum px-5 py-2 text-ink-2">{g.publicPresets}</td>
                    <td className="tnum px-5 py-2 text-ink-2">{g.snapshots}</td>
                    <td className="px-5 py-2 text-ink-2">{timeAgo(g.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          icon={<CreditCard />}
          title="Paddle events"
          subtitle={`${d.billing.length} received`}
        >
          {d.billing.length === 0 ? (
            <p className="text-[13px] text-ink-3">None.</p>
          ) : (
            <ul className="flex flex-col">
              {d.billing.map((e) => (
                <li key={e.id} className="border-b border-line py-2 text-[13px] last:border-0">
                  <details>
                    <summary className="flex cursor-pointer items-baseline justify-between gap-3">
                      <span className="text-ink-2">{e.type}</span>
                      <span className="text-[12px] text-ink-3">{dateTime(e.at)}</span>
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-ground p-3 text-[11px] text-ink-3">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={<History />} title="Admin actions on this account">
          <AuditList entries={d.audit} showTarget={false} />
        </Panel>
      </div>
    </div>
  );
}
