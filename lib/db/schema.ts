/**
 * Database schema — ConfigSync.
 *
 * Hierarchy: user → games → presets → categories → settings.
 * Settings are generic (typed value stored as JSON); no game-specific columns exist.
 * Every row that a user owns carries `user_id` so authorization is a single WHERE clause.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

// ---------------------------------------------------------------------------
// Auth (managed by better-auth; column names follow its Drizzle adapter)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Profiles & preferences
// ---------------------------------------------------------------------------

export type UserPreferences = {
  copyFormat?: "plain" | "markdown" | "json";
  theme?: "dark" | "light" | "system";
  density?: "comfortable" | "compact";
};

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Lowercase, URL-safe. Reserved for future public pages (/p/:username/...). */
    username: text("username").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    preferences: jsonb("preferences").$type<UserPreferences>().default({}).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("profiles_username_uq").on(t.username)],
);

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** cover | screenshot (future OCR workflow) */
    kind: text("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("attachments_user_id_idx").on(t.userId)],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    platforms: text("platforms")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    /** User-supplied cover: either an uploaded attachment or an external https URL. */
    coverAttachmentId: uuid("cover_attachment_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    coverUrl: text("cover_url"),
    /** Hex color used as the game's accent (theme foundation). */
    accentColor: text("accent_color"),
    notes: text("notes"),
    /** Id of the catalog template this game was created from (catalog/<id>.json). */
    catalogId: text("catalog_id"),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("games_user_slug_uq").on(t.userId, t.slug),
    index("games_user_archived_idx").on(t.userId, t.isArchived),
    index("games_user_opened_idx").on(t.userId, t.lastOpenedAt),
  ],
);

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const presetVisibility = pgEnum("preset_visibility", ["private", "public"]);

export const presets = pgTable(
  "presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    notes: text("notes"),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    /** Private by default. Public pages resolve through `shareToken`, never the id. */
    visibility: presetVisibility("visibility").default("private").notNull(),
    shareToken: text("share_token"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("presets_game_slug_uq").on(t.gameId, t.slug),
    uniqueIndex("presets_share_token_uq").on(t.shareToken),
    index("presets_game_idx").on(t.gameId),
    index("presets_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

// ---------------------------------------------------------------------------
// Categories & settings
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    presetId: uuid("preset_id")
      .notNull()
      .references(() => presets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Optional lucide icon name. */
    icon: text("icon"),
    position: integer("position").default(0).notNull(),
    isCollapsed: boolean("is_collapsed").default(false).notNull(),
    ...timestamps,
  },
  (t) => [index("categories_preset_position_idx").on(t.presetId, t.position)],
);

export const settingType = pgEnum("setting_type", [
  "boolean",
  "integer",
  "decimal",
  "slider",
  "percentage",
  "text",
  "long_text",
  "dropdown",
  "enum",
  "multi_select",
  "keybind",
  "controller_binding",
  "color",
  "resolution",
  "info",
]);

export type SettingOption = { label: string; value: string };

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** Denormalised for cheap preset-wide queries (search, export, compare). */
    presetId: uuid("preset_id")
      .notNull()
      .references(() => presets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: settingType("type").notNull(),
    /** Typed JSON value; shape depends on `type` (see lib/settings/types.ts). */
    value: jsonb("value"),
    description: text("description"),
    unit: text("unit"),
    min: numeric("min", { mode: "number" }),
    max: numeric("max", { mode: "number" }),
    step: numeric("step", { mode: "number" }),
    defaultValue: jsonb("default_value"),
    options: jsonb("options").$type<SettingOption[]>(),
    notes: text("notes"),
    position: integer("position").default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    index("settings_category_position_idx").on(t.categoryId, t.position),
    index("settings_preset_idx").on(t.presetId),
    index("settings_user_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// Revisions (version history foundation)
// ---------------------------------------------------------------------------

export const revisions = pgTable(
  "revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    presetId: uuid("preset_id")
      .notNull()
      .references(() => presets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Full preset snapshot in the export format (lib/import-export/schema.ts). */
    snapshot: jsonb("snapshot").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("revisions_preset_created_idx").on(t.presetId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Companion CLI: personal access tokens and what it found installed
// ---------------------------------------------------------------------------

export const companionTokens = pgTable(
  "companion_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** sha256 hex of the token; the token itself is shown once and never stored. */
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("companion_tokens_hash_uq").on(t.tokenHash),
    index("companion_tokens_user_idx").on(t.userId),
  ],
);

export const deviceGameSource = pgEnum("device_game_source", ["steam", "epic"]);

export const deviceGames = pgTable(
  "device_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    device: text("device").notNull(),
    source: deviceGameSource("source").notNull(),
    appId: text("app_id").notNull(),
    name: text("name").notNull(),
    installDir: text("install_dir"),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("device_games_uq").on(t.userId, t.device, t.source, t.appId)],
);

export type CompanionToken = typeof companionTokens.$inferSelect;
export type DeviceGame = typeof deviceGames.$inferSelect;

// ---------------------------------------------------------------------------
// Billing (written only by the Paddle webhook — see lib/billing)
// ---------------------------------------------------------------------------

export const planSource = pgEnum("plan_source", ["subscription", "lifetime", "manual"]);

export const plans = pgTable("plans", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  source: planSource("source").notNull(),
  paddleCustomerId: text("paddle_customer_id"),
  paddleSubscriptionId: text("paddle_subscription_id"),
  /** Paddle's status string as received: active, trialing, past_due, paused, canceled. */
  subscriptionStatus: text("subscription_status"),
  /** Pro lasts until here when the subscription is canceled. */
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** Every webhook we accepted, keyed by Paddle's event id so retries are no-ops. */
export const billingEvents = pgTable("billing_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  userId: text("user_id"),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PlanRowSelect = typeof plans.$inferSelect;

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  games: many(games),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  user: one(users, { fields: [games.userId], references: [users.id] }),
  cover: one(attachments, { fields: [games.coverAttachmentId], references: [attachments.id] }),
  presets: many(presets),
}));

export const presetsRelations = relations(presets, ({ one, many }) => ({
  game: one(games, { fields: [presets.gameId], references: [games.id] }),
  categories: many(categories),
  settings: many(settings),
  revisions: many(revisions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  preset: one(presets, { fields: [categories.presetId], references: [presets.id] }),
  settings: many(settings),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  category: one(categories, { fields: [settings.categoryId], references: [categories.id] }),
  preset: one(presets, { fields: [settings.presetId], references: [presets.id] }),
}));

export const revisionsRelations = relations(revisions, ({ one }) => ({
  preset: one(presets, { fields: [revisions.presetId], references: [presets.id] }),
}));

export type Game = typeof games.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Revision = typeof revisions.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type SettingType = (typeof settingType.enumValues)[number];
