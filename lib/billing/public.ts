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
    "Public profile with your configs (coming soon)",
  ],
  pro: [
    "Unlimited games and presets",
    "Unlimited snapshot history",
    "Auto-switch: the companion applies presets when a game starts (coming soon)",
    "AI screenshot importer (coming soon)",
    "Cloud sync across your PCs (coming soon)",
  ],
} as const;
