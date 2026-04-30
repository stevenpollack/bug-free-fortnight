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

// ---------------------------------------------------------------------------
// Meal planner
// ---------------------------------------------------------------------------

export const DayOfWeek = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export type DayOfWeek = z.infer<typeof DayOfWeek>;

export const MealPlanSlotWrite = z
  .object({
    day_of_week: DayOfWeek,
    recipe_id: z.string().uuid().nullable().optional(),
    note: z.string().max(200).nullable().optional(),
  })
  .refine((v) => !(v.recipe_id && v.note), {
    message: "A slot cannot have both recipe_id and note set",
    path: ["recipe_id"],
  });

export type MealPlanSlotWrite = z.infer<typeof MealPlanSlotWrite>;

export const MealPlanCreate = z.object({
  name: z.string().max(100).nullable().optional(),
});
export type MealPlanCreate = z.infer<typeof MealPlanCreate>;

export const MealPlanUpdate = z.object({
  name: z.string().max(100).nullable().optional(),
});
export type MealPlanUpdate = z.infer<typeof MealPlanUpdate>;

// ---------------------------------------------------------------------------
// Shopping list
// ---------------------------------------------------------------------------

export const ShoppingListItemPatch = z.object({
  checked: z.boolean().optional(),
  item: z.string().min(1).optional(),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type ShoppingListItemPatch = z.infer<typeof ShoppingListItemPatch>;

export const ShoppingListItemCreate = z.object({
  item: z.string().min(1),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type ShoppingListItemCreate = z.infer<typeof ShoppingListItemCreate>;

// ---------------------------------------------------------------------------
// Meal plan generation
// ---------------------------------------------------------------------------

export const GeneratedSlot = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("existing"),
    day: DayOfWeek,
    recipeId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("new"),
    day: DayOfWeek,
    recipe: RecipeCreate,
  }),
]);

export type GeneratedSlot = z.infer<typeof GeneratedSlot>;

export const LlmMealPlanOutput = z.object({
  slots: z.array(GeneratedSlot),
});

export type LlmMealPlanOutput = z.infer<typeof LlmMealPlanOutput>;

export const MealPlanGenerateBody = z
  .object({
    planId: z.string().uuid(),
  })
  .and(
    z.union([
      z.object({ prompt: z.string().min(1).max(1000) }),
      z.object({ rawJson: z.string().min(1) }),
    ]),
  );

export type MealPlanGenerateBody = z.infer<typeof MealPlanGenerateBody>;

// ---------------------------------------------------------------------------
// Recipe generation
// ---------------------------------------------------------------------------

export const RecipeGenerateBody = z.object({
  prompt: z.string().min(1).max(1000),
  servings: z.number().int().min(1).optional(),
  dietary: z.string().max(500).optional(),
});

export type RecipeGenerateBody = z.infer<typeof RecipeGenerateBody>;

// ---------------------------------------------------------------------------
// Client log forwarding
// ---------------------------------------------------------------------------

export const ClientLogBody = z.object({
  level: z.enum(["warn", "error"]),
  message: z.string().min(1).max(2000),
  fields: z
    .record(z.string(), z.unknown())
    .refine((v) => Object.keys(v).length <= 50, {
      message: "fields must have 50 keys or fewer",
    })
    .optional(),
  scope: z.string().max(100).optional(),
});

export type ClientLogBody = z.infer<typeof ClientLogBody>;
