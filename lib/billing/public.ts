/** Client-safe billing constants. Price ids come from the server as props; these are display-only. */
export const PADDLE_PUBLIC = {
  token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  environment: process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production",
} as const;

export const PRICES = { monthly: "2.99 €/month", lifetime: "24.99 € once" } as const;

export const FEATURES = {
  free: [
    "Web app and the csync companion",
    "Up to 3 active games",
    "Manual apply with automatic local backups",
    "10 snapshots per preset",
    "Public profile with your configs and links",
  ],
  pro: [
    "Unlimited games and presets",
    "Unlimited snapshot history",
    "Auto-switch: your PC keeps every game's files equal to its Default preset (csync watch)",
    "AI screenshot importer (30 screenshots a day)",
    "Per-PC presets: choose what each PC runs and see what's applied where",
  ],
} as const;
