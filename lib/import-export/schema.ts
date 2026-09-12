/**
 * GameSettings Vault interchange format — version 1.
 *
 * This is the shape of every export file, revision snapshot and import.
 * Documented in docs/import-export.md. Keep it backwards compatible: add optional
 * fields, never rename or repurpose existing ones. Bump `version` only for breaking changes.
 */
import { z } from "zod";
import {
  resolutionSchema,
  settingOptionSchema,
  settingTypeSchema,
  type SettingValue,
} from "@/lib/settings/types";

export const FORMAT_ID = "gamesettings-vault";
export const FORMAT_VERSION = 1;

const optionalText = (max: number) => z.string().trim().max(max).nullish();
const tagList = z.array(z.string().trim().min(1).max(40)).max(50).default([]);

export const settingValueSchema: z.ZodType<SettingValue> = z.union([
  z.boolean(),
  z.number().finite(),
  z.string().max(10_000),
  z.array(z.string().max(500)).max(100),
  resolutionSchema,
]);

export const settingDocSchema = z.object({
  name: z.string().trim().min(1, "Setting name is required").max(120),
  type: settingTypeSchema,
  value: settingValueSchema.nullish(),
  description: optionalText(500),
  unit: optionalText(20),
  min: z.number().finite().nullish(),
  max: z.number().finite().nullish(),
  step: z.number().finite().positive().nullish(),
  defaultValue: settingValueSchema.nullish(),
  options: z.array(settingOptionSchema).max(200).nullish(),
  notes: optionalText(2_000),
});

export const categoryDocSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(80),
  icon: optionalText(40),
  settings: z.array(settingDocSchema).max(1_000).default([]),
});

export const presetDocSchema = z.object({
  name: z.string().trim().min(1, "Preset name is required").max(80),
  description: optionalText(500),
  notes: optionalText(5_000),
  tags: tagList,
  isDefault: z.boolean().default(false),
  categories: z.array(categoryDocSchema).max(200).default([]),
});

export const gameDocSchema = z.object({
  name: z.string().trim().min(1, "Game name is required").max(120),
  platforms: tagList,
  tags: tagList,
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  coverUrl: z
    .url({ protocol: /^https$/ })
    .max(2_000)
    .nullish(),
  notes: optionalText(5_000),
  /** Catalog template this game came from; optional and informational. */
  catalogId: z.string().trim().max(60).nullish(),
  presets: z.array(presetDocSchema).max(200).default([]),
});

export const exportFileSchema = z.object({
  format: z.literal(FORMAT_ID),
  version: z.literal(FORMAT_VERSION),
  kind: z.enum(["library", "game", "preset"]).default("library"),
  exportedAt: z.string().optional(),
  app: z.object({ name: z.string(), version: z.string().optional() }).optional(),
  games: z.array(gameDocSchema).min(1, "The file contains no games").max(500),
});

export type SettingDoc = z.infer<typeof settingDocSchema>;
export type CategoryDoc = z.infer<typeof categoryDocSchema>;
export type PresetDoc = z.infer<typeof presetDocSchema>;
export type GameDoc = z.infer<typeof gameDocSchema>;
export type ExportFile = z.infer<typeof exportFileSchema>;

/** Input variants (before zod defaults are applied) — handy for building docs in code. */
export type SettingDocInput = z.input<typeof settingDocSchema>;
export type CategoryDocInput = z.input<typeof categoryDocSchema>;
export type PresetDocInput = z.input<typeof presetDocSchema>;
export type GameDocInput = z.input<typeof gameDocSchema>;
