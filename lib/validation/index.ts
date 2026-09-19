/**
 * Input schemas for server actions. Every mutation validates with one of these before
 * touching the database. Keep limits in sync with lib/import-export/schema.ts.
 */
import { z } from "zod";
import { settingOptionSchema, settingTypeSchema } from "@/lib/settings/types";
import { settingValueSchema } from "@/lib/import-export/schema";

export const id = z.uuid("Invalid id");

const trimmed = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long (max ${max})`);
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullish();

export const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(50)
  .transform((arr) => Array.from(new Set(arr.map((t) => t.trim()).filter(Boolean))));

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #7c5cff")
  .nullish();

export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2_000)
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .refine((v) => v == null || /^https:\/\//.test(v), "Cover URL must start with https://");

export const catalogIdSchema = z.string().regex(/^[a-z0-9-]+$/, "Invalid catalog id");

export const gameInputSchema = z.object({
  name: trimmed(120, "Game name"),
  catalogId: catalogIdSchema.nullish(),
  platforms: tagsSchema.default([]),
  tags: tagsSchema.default([]),
  accentColor: hexColorSchema,
  coverUrl: httpsUrlSchema,
  notes: optionalTrimmed(5_000),
});
export type GameInput = z.infer<typeof gameInputSchema>;

export const presetInputSchema = z.object({
  name: trimmed(80, "Preset name"),
  description: optionalTrimmed(500),
  notes: optionalTrimmed(5_000),
  tags: tagsSchema.default([]),
});
export type PresetInput = z.infer<typeof presetInputSchema>;

export const presetStartSchema = z.enum(["empty", "starter", "copy"]);

export const categoryInputSchema = z.object({
  name: trimmed(80, "Category name"),
  icon: optionalTrimmed(40),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const settingInputSchema = z
  .object({
    categoryId: id,
    name: trimmed(120, "Setting name"),
    type: settingTypeSchema,
    value: settingValueSchema.nullish(),
    description: optionalTrimmed(500),
    unit: optionalTrimmed(20),
    min: z.number().finite().nullish(),
    max: z.number().finite().nullish(),
    step: z.number().finite().positive().nullish(),
    defaultValue: settingValueSchema.nullish(),
    options: z.array(settingOptionSchema).max(200).nullish(),
    notes: optionalTrimmed(2_000),
  })
  .refine((s) => s.min == null || s.max == null || s.min <= s.max, {
    message: "Min must be less than or equal to max",
    path: ["min"],
  });
export type SettingInput = z.infer<typeof settingInputSchema>;

export const settingValueUpdateSchema = z.object({
  id,
  value: settingValueSchema.nullish(),
});

const httpsLink = z
  .string()
  .trim()
  .max(200, "Links are too long (max 200)")
  .regex(/^https:\/\/\S+$/, "Links must start with https://");

export const profileInputSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username needs at least 3 characters")
    .max(32, "Username is too long")
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Use letters, numbers and hyphens only"),
  displayName: optionalTrimmed(80),
  isPublic: z.boolean().default(false),
  bio: optionalTrimmed(300),
  links: z.array(httpsLink).max(6, "Up to 6 links").default([]),
});

export const preferencesSchema = z.object({
  copyFormat: z.enum(["plain", "markdown", "json"]).optional(),
  density: z.enum(["comfortable", "compact"]).optional(),
});

/** Catalog file id → raw file text. Real config files are a few KB; 512 KB catches the wrong file. */
export const configFilesSchema = z.record(
  z.string().max(40),
  z.string().max(512 * 1024, "Each file must be 512 KB or smaller."),
);
