import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/lib/db";
import { env, githubOAuthEnabled } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { createProfileForUser } from "@/lib/auth/profile";

export const auth = betterAuth({
  appName: "GameSettings Vault",
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
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited on purpose: keeps response timing independent of the mail server.
      void sendEmail({
        to: user.email,
        subject: "Reset your GameSettings Vault password",
        text: `Someone requested a password reset for your account.\n\nReset it here (valid for 1 hour):\n${url}\n\nIf this wasn't you, you can ignore this email.`,
      });
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
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  advanced: {
    cookiePrefix: "gsv",
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
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
