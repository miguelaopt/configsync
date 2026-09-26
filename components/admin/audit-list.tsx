import Link from "next/link";

type Entry = {
  id: string;
  action: string;
  targetUserId: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
  actorEmail: string | null;
};

const LABELS: Record<string, string> = {
  grant_pro: "Granted Pro",
  revoke_pro: "Revoked granted Pro",
  revoke_sessions: "Signed out everywhere",
  revoke_companion_tokens: "Revoked companion tokens",
  ban: "Suspended",
  unban: "Lifted suspension",
  verify_email: "Marked email verified",
  delete_user: "Deleted account",
  impersonate: "Started viewing as",
  stop_impersonating: "Stopped viewing as",
  email_user: "Emailed",
  hide_preset: "Made a public preset private",
};

/** Who did what to whom, newest first. `details` minus the email is shown as-is. */
export function AuditList({
  entries,
  showTarget = true,
}: {
  entries: Entry[];
  showTarget?: boolean;
}) {
  if (entries.length === 0) return <p className="text-[13px] text-ink-3">Nothing yet.</p>;
  return (
    <ul className="flex flex-col">
      {entries.map((e) => {
        const { email, ...rest } = e.details as { email?: string };
        const extra = Object.entries(rest)
          .filter(([, v]) => v !== null && v !== "" && v !== undefined)
          .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join(" · ");
        return (
          <li
            key={e.id}
            className="flex flex-col gap-0.5 border-b border-line py-2 text-[13px] last:border-0"
          >
            <span className="text-ink">
              {LABELS[e.action] ?? e.action}
              {showTarget && email ? (
                <>
                  {" "}
                  {e.targetUserId ? (
                    <Link
                      href={`/admin/users/${e.targetUserId}`}
                      className="text-accent-text hover:underline"
                    >
                      {email}
                    </Link>
                  ) : (
                    email
                  )}
                </>
              ) : null}
            </span>
            <span className="text-[12px] text-ink-3">
              {e.actorEmail ?? "a removed admin"} ·{" "}
              {e.createdAt.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              })}{" "}
              UTC
              {extra ? ` · ${extra}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
