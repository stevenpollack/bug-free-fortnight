import { z } from "zod";

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------

export const TagInput = z.object({
  name: z.string().min(1),
  category: z.string().min(1).nullable().optional(),
});

export type TagInput = z.infer<typeof TagInput>;

// ---------------------------------------------------------------------------
// Ingredient
// ---------------------------------------------------------------------------

export const IngredientInput = z.object({
  displayOrder: z.number().int().nonnegative(),
  groupHeading: z.string().nullable().optional(),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  item: z.string().min(1),
  notes: z.string().nullable().optional(),
  originalLine: z.string().min(1),
});

export type IngredientInput = z.infer<typeof IngredientInput>;

// ---------------------------------------------------------------------------
// Recipe
// ---------------------------------------------------------------------------

export const RecipeBase = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  baseServings: z.number().int().min(1).default(1),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  instructions: z.array(z.string()).default([]),
  favourite: z.boolean().default(false),
});

export type RecipeBase = z.infer<typeof RecipeBase>;

// ---------------------------------------------------------------------------
// Ingredient (write — used in create/update bodies; displayOrder and originalLine optional)
// ---------------------------------------------------------------------------

export const IngredientWrite = z.object({
  displayOrder: z.number().int().nonnegative().optional(),
  groupHeading: z.string().nullable().optional(),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  item: z.string().min(1),
  notes: z.string().nullable().optional(),
  // Server defaults to `item` when not provided (e.g. manual entry)
  originalLine: z.string().optional(),
});

export type IngredientWrite = z.infer<typeof IngredientWrite>;

// ---------------------------------------------------------------------------
// Recipe (create / update)
// ---------------------------------------------------------------------------

export const RecipeCreate = RecipeBase.extend({
  ingredients: z.array(IngredientWrite).default([]),
  tagIds: z.array(z.string().uuid()).default([]),
});

export type RecipeCreate = z.infer<typeof RecipeCreate>;

// PUT is a full replace — same shape as create.
export const RecipeUpdate = RecipeCreate;
export type RecipeUpdate = z.infer<typeof RecipeUpdate>;

// ---------------------------------------------------------------------------
// Import preview body
// ---------------------------------------------------------------------------

export const ImportPreviewBody = z.object({
  url: z.string().url(),
});

export type ImportPreviewBody = z.infer<typeof ImportPreviewBody>;

// ---------------------------------------------------------------------------
// Favourite body (unused — toggle semantics need no body; kept for completeness)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Health (kept for backwards-compat with any existing consumers)
// ---------------------------------------------------------------------------

export const healthSchema = z.object({
  ok: z.boolean(),
});

export type Health = z.infer<typeof healthSchema>;
