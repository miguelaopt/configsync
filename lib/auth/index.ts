import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db, schema } from "@/lib/db";
import { emailVerificationRequired, env, githubOAuthEnabled } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail, verifyEmail } from "@/lib/email-templates";
import { createProfileForUser } from "@/lib/auth/profile";
import { LEGAL } from "@/lib/legal";

export const auth = betterAuth({
  appName: "ConfigSync",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Ignored for new accounts while verification is required: sign-up then creates no session.
    requireEmailVerification: emailVerificationRequired,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited on purpose: keeps response timing independent of the mail server.
      void sendEmail({ to: user.email, ...resetPasswordEmail({ url, name: user.name }) });
    },
  },
  // Social sign-ins arrive verified by the provider. better-auth links one to an existing account
  // with the same email only once that account's email is verified (requireLocalEmailVerified,
  // on by default) — so nobody can sign up with someone else's address and wait for them.
  emailVerification: {
    sendOnSignUp: emailVerificationRequired,
    // An unverified account that tries to sign in gets a fresh link instead of a dead end.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({ to: user.email, ...verifyEmail({ url, name: user.name }) });
    },
  },
  socialProviders: githubOAuthEnabled
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID!,
          clientSecret: env.GITHUB_CLIENT_SECRET!,
        },
      }
    : {},
  user: {
    deleteUser: { enabled: true },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
    // Short, so a ban, a role change or "sign out everywhere" reaches open tabs within a minute.
    cookieCache: { enabled: true, maxAge: 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  advanced: {
    cookiePrefix: "csync",
    useSecureCookies: env.NODE_ENV === "production",
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createProfileForUser({ id: user.id, name: user.name, email: user.email });
        },
      },
    },
  },
  plugins: [
    // Roles, bans and "view as" for /admin. Who is admin comes from ADMIN_EMAILS (lib/db/admins.ts).
    admin({
      bannedUserMessage: `This account is suspended. Write to ${LEGAL.email} if you think that's a mistake.`,
      impersonationSessionDuration: 60 * 60,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
