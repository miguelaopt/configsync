"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

const FRIENDLY: Record<string, string> = {
  USER_ALREADY_EXISTS: "An account with this email already exists. Sign in instead.",
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match.",
  INVALID_EMAIL: "Enter a valid email address.",
  PASSWORD_TOO_SHORT: "Use at least 8 characters.",
  PASSWORD_TOO_LONG: "Passwords can't be longer than 128 characters.",
  INVALID_TOKEN: "This reset link is invalid or has expired. Request a new one.",
};

function friendly(error: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!error) return "Something went wrong. Try again.";
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  return FRIENDLY[error.code ?? ""] ?? error.message ?? "Something went wrong. Try again.";
}

export function SignInForm({ githubEnabled }: { githubEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) return setError(friendly(error));
    router.push(next);
    router.refresh();
  };

  return (
    <div>
      <h1 className="font-display text-2xl">Sign in</h1>
      <p className="mt-1 text-[13px] text-ink-2">
        Welcome back. Your settings are where you left them.
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint={
            <Link href="/forgot-password" className="text-ink-2 hover:text-ink">
              Forgot password?
            </Link>
          }
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error ? (
          <p
            role="alert"
            className="rounded-sm border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={pending} className="mt-1">
          Sign in
        </Button>
      </form>
      {githubEnabled ? (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "github", callbackURL: next })}
          >
            <GithubIcon /> Continue with GitHub
          </Button>
        </>
      ) : null}
      <p className="mt-6 text-center text-[13px] text-ink-2">
        New here?{" "}
        <Link
          href={`/sign-up${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-ink underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm({ githubEnabled }: { githubEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name: name.trim(), email, password });
    setPending(false);
    if (error) return setError(friendly(error));
    router.push(next);
    router.refresh();
  };

  return (
    <div>
      <h1 className="font-display text-2xl">Create your vault</h1>
      <p className="mt-1 text-[13px] text-ink-2">Free to start. Export everything, any time.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field
          label="Name"
          htmlFor="name"
          hint="Shown in the app. Your username is picked from it and can be changed later."
        >
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            maxLength={80}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </Field>
        {error ? (
          <p
            role="alert"
            className="rounded-sm border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={pending} className="mt-1">
          Create account
        </Button>
      </form>
      {githubEnabled ? (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "github", callbackURL: next })}
          >
            <GithubIcon /> Continue with GitHub
          </Button>
        </>
      ) : null}
      <p className="mt-6 text-center text-[13px] text-ink-2">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) return setError(friendly(error));
    setSent(true);
  };

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-2xl">Check your email</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          If an account exists for <span className="text-ink">{email}</span>, a reset link is on its
          way. It expires in one hour.
        </p>
        <p className="mt-4 text-[13px] text-ink-3">
          Self-hosting without email configured? The link is printed in the server log.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl">Reset your password</h1>
      <p className="mt-1 text-[13px] text-ink-2">Enter your email and we’ll send a reset link.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        {error ? (
          <p
            role="alert"
            className="rounded-sm border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={pending}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-ink-2">
        <Link href="/sign-in" className="text-ink underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match.");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (!token) return setError("This reset link is missing its token. Request a new one.");
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) return setError(friendly(error));
    router.push("/sign-in?reset=1");
  };

  return (
    <div>
      <h1 className="font-display text-2xl">Choose a new password</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        {error ? (
          <p
            role="alert"
            className="rounded-sm border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={pending}>
          Update password
        </Button>
      </form>
    </div>
  );
}
