/** Client-safe billing constants. Price ids come from the server as props; these are display-only. */
export const PADDLE_PUBLIC = {
  token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  environment: process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production",
} as const;

export const PRICES = {
  monthly: "2.99 €/month",
  lifetime: "24.99 € once",
  /** The bare amounts, for layouts that set the period in their own type scale. */
  monthlyAmount: "2.99 €",
  lifetimeAmount: "24.99 €",
} as const;

/**
 * The alpha founder offer on the lifetime licence. Shown only where the server says the discount
 * is configured (`founderOfferEnabled`); Paddle is what actually charges.
 *
 * ponytail: written here rather than read back from Paddle, so the discount in the Paddle
 * dashboard must be a **fixed 14.99 € off** the 24.99 € lifetime price to land exactly on this
 * number. If it ever becomes a percentage, read the real amount from Paddle's price preview
 * instead of editing this string.
 */
export const FOUNDER = { lifetime: "10 € once", was: PRICES.lifetimeAmount } as const;

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

/**
 * The full Free/Pro matrix shown on the pricing page. `true` renders a tick, `false` a dash,
 * a string renders as-is. Keep it honest: every row here is something the app actually does.
 */
export const COMPARISON: {
  group: string;
  rows: { label: string; detail?: string; free: string | boolean; pro: string | boolean }[];
}[] = [
  {
    group: "Your library",
    rows: [
      {
        label: "Active games",
        detail: "Archived games never count, and archiving keeps everything.",
        free: "3",
        pro: "Unlimited",
      },
      { label: "Presets per game", free: "Unlimited", pro: "Unlimited" },
      { label: "Settings per preset", free: "Unlimited", pro: "Unlimited" },
      {
        label: "Snapshot history",
        detail: "Every save keeps a snapshot you can restore.",
        free: "Last 10 per preset",
        pro: "Every save, kept",
      },
      { label: "Categories, tags and notes", free: true, pro: true },
    ],
  },
  {
    group: "Getting settings in and out",
    rows: [
      { label: "Type settings in by hand", free: true, pro: true },
      {
        label: "Import a game's own config files",
        detail: "Through the companion, from Steam and Epic installs.",
        free: true,
        pro: true,
      },
      { label: "Export as text, Markdown, CSV or JSON", free: true, pro: true },
      { label: "Full library export and re-import", free: true, pro: true },
      {
        label: "Import a settings menu from a screenshot",
        detail: "Reads the values off a screenshot of the game's own menu.",
        free: false,
        pro: "30 a day",
      },
    ],
  },
  {
    group: "Your PCs",
    rows: [
      {
        label: "The csync companion",
        detail: "Scans installed games, applies presets, always backs the file up first.",
        free: true,
        pro: true,
      },
      { label: "Apply a preset by hand", free: true, pro: true },
      {
        label: "Auto-switch",
        detail: "Your PC keeps each game's files equal to its Default preset.",
        free: false,
        pro: true,
      },
      {
        label: "Per-PC presets",
        detail: "The desktop runs Competitive, the laptop runs Laptop.",
        free: false,
        pro: true,
      },
      { label: "See what is applied where", free: false, pro: true },
    ],
  },
  {
    group: "Sharing",
    rows: [
      { label: "Public profile at /p/you", free: true, pro: true },
      { label: "Share a single preset by link", free: true, pro: true },
      { label: "Copy a preset from someone else", free: true, pro: true },
      { label: "Social links on your profile", free: "Up to 6", pro: "Up to 6" },
    ],
  },
];
