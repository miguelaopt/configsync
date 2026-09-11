"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/alert-dialog";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!hasPassword) {
    return (
      <p className="text-[13px] text-ink-2">
        You signed up with GitHub, so there’s no password to change.
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError("Use at least 8 characters.");
    if (next !== confirm) return setError("The new passwords don't match.");
    setPending(true);
    setError(null);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error)
      return setError(
        error.code === "INVALID_PASSWORD"
          ? "Your current password is wrong."
          : (error.message ?? "Couldn't change the password."),
      );
    toast.success("Password changed. Other devices were signed out.");
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
      <Field label="Current password" htmlFor="current-password">
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </Field>
      <Field label="New password" htmlFor="new-password" hint="At least 8 characters.">
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm-password">
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </Field>
      {error ? (
        <p role="alert" className="text-[13px] text-bad">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  return (
    <div className="max-w-md">
      <p className="text-[13px] text-ink-2">
        Deleting your account removes every game, preset, setting and image. Export your library
        first — this can’t be undone.
      </p>
      <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}>
        Delete account…
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description={
          <span className="flex flex-col gap-3">
            <span>Everything you saved is permanently removed.</span>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Confirm your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
          </span>
        }
        confirmLabel="Delete everything"
        loading={pending}
        onConfirm={async () => {
          setPending(true);
          const { error } = await authClient.deleteUser({ password });
          setPending(false);
          if (error) {
            toast.error(
              error.code === "INVALID_PASSWORD"
                ? "That password is wrong."
                : (error.message ?? "Couldn't delete the account."),
            );
            throw new Error("cancelled");
          }
          router.push("/");
          router.refresh();
        }}
      />
    </div>
  );
}
