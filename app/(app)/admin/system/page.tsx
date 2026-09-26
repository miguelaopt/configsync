import type { Metadata } from "next";
import {
  Bug,
  Database,
  HardDriveDownload,
  Mail,
  Megaphone,
  Power,
  Server,
  Settings2,
} from "lucide-react";
import { getAdminSystem } from "@/lib/data/admin";
import { SITE } from "@/lib/site";
import { billingEnabled, env, founderCode, githubOAuthEnabled } from "@/lib/env";
import { parseAdminEmails } from "@/lib/db/admins";
import { ComingSoonPanel, Panel } from "@/components/dashboard/panels";
import { Stat, StatGrid } from "@/components/admin/stat";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "System" };

const bytes = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(2)} GB`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)} MB`
      : `${Math.round(n / 1e3)} kB`;

function Flag({ label, on, detail }: { label: string; on: boolean; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[13px] last:border-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="flex items-center gap-2 text-ink-2">
        {detail ? <span className="text-[12px] text-ink-3">{detail}</span> : null}
        <Badge variant={on ? "good" : "neutral"}>{on ? "on" : "off"}</Badge>
      </dd>
    </div>
  );
}

export default async function AdminSystemPage() {
  const s = await getAdminSystem();
  return (
    <div className="flex flex-col gap-6">
      <StatGrid>
        <Stat label="Version" value={SITE.version} detail={`Node ${process.version}`} />
        <Stat label="Database" value={bytes(s.databaseBytes)} />
        <Stat
          label="Active sessions"
          value={s.sessions.active.toLocaleString("en")}
          detail={`${s.sessions.impersonating} opened by an admin`}
        />
        <Stat
          label="Server uptime"
          value={`${Math.floor(process.uptime() / 3600)} h`}
          detail="Since the app container started"
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          icon={<Settings2 />}
          title="Configuration"
          subtitle="What this server was started with"
        >
          <dl>
            <Flag
              label="Payments (Paddle)"
              on={billingEnabled}
              detail={process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : undefined}
            />
            <Flag
              label="Founder discount"
              on={founderCode !== null}
              detail={founderCode ?? undefined}
            />
            <Flag
              label="Screenshot import"
              on={Boolean(env.AI_VISION_PROVIDER)}
              detail={
                env.AI_VISION_PROVIDER === "anthropic"
                  ? env.AI_VISION_MODEL
                  : env.AI_VISION_PROVIDER
              }
            />
            <Flag label="Email (SMTP)" on={Boolean(env.SMTP_URL)} detail={env.EMAIL_FROM} />
            <Flag label="Sign in with GitHub" on={githubOAuthEnabled} />
            <Flag
              label="Admins"
              on
              detail={`${parseAdminEmails(env.ADMIN_EMAILS).length} in ADMIN_EMAILS`}
            />
          </dl>
        </Panel>

        <Panel
          icon={<Database />}
          title="Tables"
          subtitle="Estimated rows and size on disk"
          bodyClassName="px-0 pb-2"
        >
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line text-ink-3">
              <tr>
                <th className="px-5 py-2 font-medium">Table</th>
                <th className="px-5 py-2 text-right font-medium">Rows</th>
                <th className="px-5 py-2 text-right font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {s.tables.map((t) => (
                <tr key={t.table} className="border-b border-line last:border-0">
                  <td className="px-5 py-1.5 text-ink">{t.table}</td>
                  <td className="tnum px-5 py-1.5 text-right text-ink-2">
                    {t.rows.toLocaleString("en")}
                  </td>
                  <td className="tnum px-5 py-1.5 text-right text-ink-2">{bytes(t.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <ComingSoonPanel
          icon={<Bug />}
          title="Server errors"
          description="Errors from the app, grouped, with the account they happened to. Today they are only in the container log."
        />
        <ComingSoonPanel
          icon={<Mail />}
          title="Emails sent"
          description="Every email the site sent and whether it was delivered. Needs Resend's delivery webhooks."
        />
        <ComingSoonPanel
          icon={<HardDriveDownload />}
          title="Backups"
          description="The last nightly dump and its size. The dumps live on the host, outside the app container."
        />
        <ComingSoonPanel
          icon={<Power />}
          title="Maintenance mode"
          description="Take the site down behind the maintenance page from here instead of stopping the container."
        />
        <ComingSoonPanel
          icon={<Megaphone />}
          title="Announcements"
          description="A banner inside the app for every account, or only Free or Pro."
        />
        <ComingSoonPanel
          icon={<Server />}
          title="Uptime"
          description="Response times and outages. UptimeRobot watches /pricing today."
        />
      </div>
    </div>
  );
}
