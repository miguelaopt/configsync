import { z } from "zod";

/**
 * Server-side environment. Parsed once; fails fast with a readable message.
 * Never import this from client components — only NEXT_PUBLIC_* values are safe there.
 */
const base = z.object({
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
  PADDLE_DISCOUNT_CODE: z.string().optional(),
  AI_VISION_PROVIDER: z.enum(["anthropic"]).optional(),
  AI_VISION_API_KEY: z.string().optional(),
  AI_VISION_MODEL: z.string().default("claude-opus-5"),
});
const schema = base.refine((e) => !e.AI_VISION_PROVIDER || Boolean(e.AI_VISION_API_KEY), {
  message: "AI_VISION_API_KEY is required when AI_VISION_PROVIDER is set",
  path: ["AI_VISION_API_KEY"],
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
    PADDLE_DISCOUNT_CODE: process.env.PADDLE_DISCOUNT_CODE || undefined,
    AI_VISION_PROVIDER: process.env.AI_VISION_PROVIDER || undefined,
    AI_VISION_API_KEY: process.env.AI_VISION_API_KEY || undefined,
    AI_VISION_MODEL: process.env.AI_VISION_MODEL || undefined,
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
/**
 * The alpha founder discount code on the lifetime licence, or null. Unset ⇒ nothing anywhere
 * mentions a discount. It is meant to be read out and typed, so it is not a secret.
 */
export const founderCode = billingEnabled ? (env.PADDLE_DISCOUNT_CODE ?? null) : null;
export const founderOfferEnabled = founderCode !== null;
/** Whether the screenshot importer is offered at all. Off ⇒ the UI never mentions it. */
export const screenshotAssistantEnabled = Boolean(env.AI_VISION_PROVIDER);
