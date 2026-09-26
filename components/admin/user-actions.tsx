"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  BadgeCheck,
  Crown,
  Eye,
  KeyRound,
  LogOut,
  Mail,
  MailCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  banAction,
  deleteUserAction,
  emailUserAction,
  grantProAction,
  impersonateAction,
  revokeProAction,
  revokeSessionsAction,
  revokeTokensAction,
  unbanAction,
  verifyEmailAction,
} from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea, inputClass } from "@/components/ui/input";

type Target = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isSelf: boolean;
  banned: boolean;
  emailVerified: boolean;
  plan: "free" | "pro";
  planSource: "subscription" | "lifetime" | "manual" | null;
  sessions: number;
  tokens: number;
};

type Open =
  | "grant"
  | "revoke-pro"
  | "sessions"
  | "tokens"
  | "ban"
  | "unban"
  | "verify"
  | "view"
  | "email"
  | "delete"
  | null;

/** Everything an admin can do to one account; each button asks before it acts. */
export function UserActions({ user }: { user: Target }) {
  const router = useRouter();
  const [open, setOpen] = React.useState<Open>(null);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const run = (fn: () => Promise<ActionResult>, done: string, after?: () => void) =>
    new Promise<void>((resolve) =>
      start(async () => {
        const r = await fn();
        if (r.ok) {
          toast.success(done);
          setOpen(null);
          setError(null);
          if (after) after();
          else router.refresh();
        } else {
          setError(r.error);
          toast.error(r.error);
        }
        resolve();
      }),
    );

  const protectedTarget = user.isAdmin || user.isSelf;
  const confirm = (
    key: Open,
    title: string,
    description: string,
    label: string,
    fn: () => Promise<ActionResult>,
    done: string,
    variant: "danger" | "primary" = "danger",
  ) => (
    <ConfirmDialog
      open={open === key}
      onOpenChange={(o) => setOpen(o ? key : null)}
      title={title}
      description={description}
      confirmLabel={label}
      confirmVariant={variant}
      loading={pending}
      onConfirm={() => run(fn, done)}
    />
  );

  return (
    <div className="flex flex-wrap gap-2">
      {user.planSource === "manual" ? (
        <Button size="sm" onClick={() => setOpen("revoke-pro")}>
          <Undo2 /> Revoke granted Pro
        </Button>
      ) : user.plan === "free" ? (
        <Button size="sm" variant="primary" onClick={() => setOpen("grant")}>
          <Crown /> Grant Pro
        </Button>
      ) : null}
      {!user.emailVerified ? (
        <Button size="sm" onClick={() => setOpen("verify")}>
          <MailCheck /> Mark email verified
        </Button>
      ) : null}
      <Button size="sm" onClick={() => setOpen("email")}>
        <Mail /> Email
      </Button>
      {!protectedTarget ? (
        <>
          <Button size="sm" onClick={() => setOpen("view")} disabled={user.banned}>
            <Eye /> View as
          </Button>
          <Button size="sm" onClick={() => setOpen("sessions")} disabled={user.sessions === 0}>
            <LogOut /> Sign out everywhere
          </Button>
        </>
      ) : null}
      <Button size="sm" onClick={() => setOpen("tokens")} disabled={user.tokens === 0}>
        <KeyRound /> Revoke companion tokens
      </Button>
      {!protectedTarget ? (
        user.banned ? (
          <Button size="sm" onClick={() => setOpen("unban")}>
            <BadgeCheck /> Lift suspension
          </Button>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setOpen("ban")}>
            <Ban /> Suspend
          </Button>
        )
      ) : null}
      {!protectedTarget ? (
        <Button size="sm" variant="danger" onClick={() => setOpen("delete")}>
          <Trash2 /> Delete account
        </Button>
      ) : null}

      {confirm(
        "revoke-pro",
        "Revoke granted Pro?",
        `${user.email} goes back to Free now.`,
        "Revoke",
        () => revokeProAction({ userId: user.id }),
        "Granted Pro revoked",
      )}
      {confirm(
        "verify",
        "Mark the email as verified?",
        `Use this when ${user.email} can't receive the verification email.`,
        "Mark verified",
        () => verifyEmailAction({ userId: user.id }),
        "Email marked verified",
        "primary",
      )}
      {confirm(
        "view",
        "View the app as this person?",
        `You'll be signed in as ${user.email} for up to an hour, and anything you do is done as them. A bar at the top stops it.`,
        "View as",
        () => impersonateAction({ userId: user.id }),
        "Viewing as them",
        "primary",
      )}
      {confirm(
        "sessions",
        "Sign out everywhere?",
        `Ends all ${user.sessions} sessions of ${user.email}. The companion keeps working (its tokens are separate).`,
        "Sign out",
        () => revokeSessionsAction({ userId: user.id }),
        "Signed out everywhere",
      )}
      {confirm(
        "tokens",
        "Revoke companion tokens?",
        `Every PC of ${user.email} stops syncing until csync login is run again.`,
        "Revoke tokens",
        () => revokeTokensAction({ userId: user.id }),
        "Companion tokens revoked",
      )}
      {confirm(
        "unban",
        "Lift the suspension?",
        `${user.email} can sign in again.`,
        "Lift suspension",
        () => unbanAction({ userId: user.id }),
        "Suspension lifted",
        "primary",
      )}

      <GrantDialog
        open={open === "grant"}
        onOpenChange={(o) => setOpen(o ? "grant" : null)}
        pending={pending}
        error={error}
        onSubmit={(note) => run(() => grantProAction({ userId: user.id, note }), "Pro granted")}
      />
      <BanDialog
        open={open === "ban"}
        onOpenChange={(o) => setOpen(o ? "ban" : null)}
        pending={pending}
        error={error}
        email={user.email}
        onSubmit={(reason, days) =>
          run(() => banAction({ userId: user.id, reason, days }), "Account suspended")
        }
      />
      <EmailDialog
        open={open === "email"}
        onOpenChange={(o) => setOpen(o ? "email" : null)}
        pending={pending}
        error={error}
        email={user.email}
        onSubmit={(subject, body) =>
          run(() => emailUserAction({ userId: user.id, subject, body }), "Email sent")
        }
      />
      <DeleteDialog
        open={open === "delete"}
        onOpenChange={(o) => setOpen(o ? "delete" : null)}
        pending={pending}
        error={error}
        email={user.email}
        onSubmit={(confirmEmail) =>
          run(
            () => deleteUserAction({ userId: user.id, confirmEmail }),
            "Account deleted",
            () => router.push("/admin/users"),
          )
        }
      />
    </div>
  );
}

type DialogProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pending: boolean;
  error: string | null;
};

function GrantDialog({ onSubmit, ...p }: DialogProps & { onSubmit: (note: string) => void }) {
  const [note, setNote] = React.useState("");
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title="Grant Pro"
        description="Pro with no end date and no payment. Paddle never touches a granted plan."
        size="sm"
      >
        <form
          onSubmit={(e) => (e.preventDefault(), onSubmit(note))}
          className="flex flex-col gap-4"
        >
          <Field label="Why" htmlFor="grant-note" optional error={p.error}>
            <Input
              id="grant-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Beta tester, refund goodwill…"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={p.pending}>
              Grant Pro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BanDialog({
  email,
  onSubmit,
  ...p
}: DialogProps & { email: string; onSubmit: (reason: string, days: number | null) => void }) {
  const [reason, setReason] = React.useState("");
  const [days, setDays] = React.useState("0");
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title="Suspend account"
        description={`${email} is signed out everywhere, its companion tokens are revoked, and it can't sign in.`}
        size="sm"
      >
        <form
          onSubmit={(e) => (
            e.preventDefault(),
            onSubmit(reason, days === "0" ? null : Number(days))
          )}
          className="flex flex-col gap-4"
        >
          <Field
            label="Reason"
            htmlFor="ban-reason"
            hint="Kept in the audit log. Not shown to them."
            error={p.error}
          >
            <Input
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              required
            />
          </Field>
          <Field label="For" htmlFor="ban-days">
            <select
              id="ban-days"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputClass}
            >
              <option value="0">Until lifted</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
            </select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={p.pending}>
              Suspend
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmailDialog({
  email,
  onSubmit,
  ...p
}: DialogProps & { email: string; onSubmit: (subject: string, body: string) => void }) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title={`Email ${email}`}
        description="Plain text, from the site's email address."
        size="md"
      >
        <form
          onSubmit={(e) => (e.preventDefault(), onSubmit(subject, body))}
          className="flex flex-col gap-4"
        >
          <Field label="Subject" htmlFor="mail-subject" error={p.error}>
            <Input
              id="mail-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
              required
            />
          </Field>
          <Field label="Message" htmlFor="mail-body">
            <Textarea
              id="mail-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={5000}
              required
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={p.pending}>
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  email,
  onSubmit,
  ...p
}: DialogProps & { email: string; onSubmit: (confirmEmail: string) => void }) {
  const [typed, setTyped] = React.useState("");
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title="Delete this account?"
        description="The account, its games, presets, snapshots, PCs and tokens are deleted for good. Payments stay in Paddle."
        size="sm"
      >
        <form
          onSubmit={(e) => (e.preventDefault(), onSubmit(typed))}
          className="flex flex-col gap-4"
        >
          <Field label={`Type ${email} to confirm`} htmlFor="delete-confirm" error={p.error}>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={p.pending}
              disabled={typed.trim().toLowerCase() !== email.toLowerCase()}
            >
              Delete account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
