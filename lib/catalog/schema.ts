import { z } from "zod";
import {
  categoryDocSchema,
  gameDocSchema,
  presetDocSchema,
  settingDocSchema,
} from "@/lib/import-export/schema";

const kv = z.record(z.string(), z.string());

export const settingSourceSchema = z.intersection(
  z.object({ file: z.string().min(1) }),
  z.union([
    z.object({ key: z.string().min(1) }),
    z.object({ width: z.string().min(1), height: z.string().min(1) }),
    z.object({ match: z.array(z.object({ value: z.string(), keys: kv })).min(1) }),
    z.object({ bind: z.string().min(1) }),
  ]),
);
export type SettingSource = z.infer<typeof settingSourceSchema>;

export const catalogFileSchema = z.object({
  id: z.string().min(1),
  format: z.enum(["keyvalues", "ini"]),
  bool: z.enum(["01", "truefalse", "TrueFalse"]),
  section: z.array(z.string()).default([]),
  paths: z.partialRecord(
    z.enum(["steam-linux", "steam-windows", "epic-linux", "epic-windows"]),
    z.string(),
  ),
});
export type CatalogFile = z.infer<typeof catalogFileSchema>;

const catalogSettingSchema = settingDocSchema.extend({ source: settingSourceSchema.optional() });
const catalogCategorySchema = categoryDocSchema.extend({ settings: z.array(catalogSettingSchema) });
const catalogPresetSchema = presetDocSchema.extend({ categories: z.array(catalogCategorySchema) });

export const catalogGameSchema = gameDocSchema.extend({
  id: z.string().regex(/^[a-z0-9-]+$/),
  steamAppId: z.number().int().positive().optional(),
  epicAppName: z.string().optional(),
  files: z.array(catalogFileSchema).default([]),
  /** Executable names as a process list shows them (no paths), any platform. */
  processNames: z.array(z.string().min(1)).default([]),
  presets: z.array(catalogPresetSchema).min(1),
});
export type CatalogGame = z.infer<typeof catalogGameSchema>;
export type CatalogSetting = z.infer<typeof catalogSettingSchema>;
