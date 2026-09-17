import { z } from "zod";

/**
 * Server-side environment. Parsed once; fails fast with a readable message.
 * Never import this from client components — only NEXT_PUBLIC_* values are safe there.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters (openssl rand -base64 32)"),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("ConfigSync <noreply@localhost>"),
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_PRICE_MONTHLY: z.string().optional(),
  PADDLE_PRICE_LIFETIME: z.string().optional(),
});

function load() {
  const parsed = schema.safeParse({
    ...process.env,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || undefined,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || undefined,
    SMTP_URL: process.env.SMTP_URL || undefined,
    PADDLE_API_KEY: process.env.PADDLE_API_KEY || undefined,
    PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET || undefined,
    PADDLE_PRICE_MONTHLY: process.env.PADDLE_PRICE_MONTHLY || undefined,
    PADDLE_PRICE_LIFETIME: process.env.PADDLE_PRICE_LIFETIME || undefined,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

export const env = load();
export const githubOAuthEnabled = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
/** No Paddle configured ⇒ no plans: every account is Pro (self-hosting). */
export const billingEnabled = Boolean(env.PADDLE_API_KEY && env.PADDLE_WEBHOOK_SECRET);
