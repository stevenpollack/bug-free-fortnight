import { z } from "zod";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./api.js";

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const IngredientWrite = z.object({
  displayOrder: z.number().int().nonnegative().optional(),
  groupHeading: z.string().nullable().optional(),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  item: z.string().min(1),
  notes: z.string().nullable().optional(),
  originalLine: z.string().optional(),
});

const RecipeBody = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  baseServings: z.number().int().min(1).optional(),
  prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  instructions: z.array(z.string()).optional(),
  favourite: z.boolean().optional(),
  ingredients: z.array(IngredientWrite).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

// ---------------------------------------------------------------------------
// Tool schemas (exported so server.ts can register them)
// ---------------------------------------------------------------------------

export const SearchRecipesInput = {
  query: z.string().optional().describe("Full-text search term"),
  tags: z.array(z.string()).optional().describe("Filter by tag names"),
  favourite: z.boolean().optional().describe("Filter to favourites only"),
};

export const GetRecipeInput = {
  id: z.string().uuid().describe("Recipe UUID"),
};

export const CreateRecipeInput = {
  recipe: RecipeBody.describe("Recipe data"),
};

export const UpdateRecipeInput = {
  id: z.string().uuid().describe("Recipe UUID"),
  recipe: RecipeBody.describe("Full replacement recipe data"),
};

export const DeleteRecipeInput = {
  id: z.string().uuid().describe("Recipe UUID"),
};

export const ImportRecipeInput = {
  url: z.string().url().describe("URL to import the recipe from"),
};

export const ToggleFavouriteInput = {
  id: z.string().uuid().describe("Recipe UUID"),
};

export const ListMealPlansInput = {};

export const CreateMealPlanInput = {
  name: z.string().max(100).optional().describe("Optional meal plan name"),
};

export const DeleteMealPlanInput = {
  id: z.string().uuid().describe("Meal plan UUID"),
};

export const SetMealPlanSlotInput = {
  planId: z.string().uuid().describe("Meal plan UUID"),
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]).describe("Day of week"),
  recipeId: z.string().uuid().optional().describe("Recipe UUID to assign"),
  note: z.string().max(200).optional().describe("Free-text note for the slot"),
};

export const ActivateMealPlanInput = {
  id: z.string().uuid().describe("Meal plan UUID"),
};

export const GenerateShoppingListInput = {
  planId: z.string().uuid().describe("Meal plan UUID"),
};

export const AddShoppingItemInput = {
  planId: z.string().uuid().describe("Meal plan UUID"),
  item: z.string().min(1).describe("Item name"),
  quantity: z.number().positive().optional().describe("Quantity"),
  unit: z.string().optional().describe("Unit of measure"),
};

export const CheckShoppingItemInput = {
  planId: z.string().uuid().describe("Meal plan UUID"),
  itemId: z.string().uuid().describe("Shopping list item UUID"),
  checked: z.boolean().describe("Checked state to set"),
};

export const ManageTagsInput = {
  action: z.enum(["create", "delete"]).describe("Action to perform"),
  name: z.string().min(1).optional().describe("Tag name (required for create)"),
  category: z.string().min(1).optional().describe("Tag category (optional for create)"),
  id: z.string().uuid().optional().describe("Tag UUID (required for delete)"),
};

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type ToolResult = { content: Array<{ type: "text"; text: string }> };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export async function searchRecipes(args: {
  query?: string;
  tags?: string[];
  favourite?: boolean;
}): Promise<ToolResult> {
  const params = new URLSearchParams();
  if (args.query) params.set("q", args.query);
  if (args.tags?.length) params.set("tag", args.tags.join(","));
  if (args.favourite !== undefined) params.set("favourite", String(args.favourite));
  const qs = params.toString();
  const data = await apiGet(`/recipes${qs ? `?${qs}` : ""}`);
  return ok(data);
}

export async function getRecipe(args: { id: string }): Promise<ToolResult> {
  const data = await apiGet(`/recipes/${args.id}`);
  return ok(data);
}

export async function createRecipe(args: {
  recipe: z.infer<typeof RecipeBody>;
}): Promise<ToolResult> {
  const data = await apiPost("/recipes", args.recipe);
  return ok(data);
}

export async function updateRecipe(args: {
  id: string;
  recipe: z.infer<typeof RecipeBody>;
}): Promise<ToolResult> {
  const data = await apiPut(`/recipes/${args.id}`, args.recipe);
  return ok(data);
}

export async function deleteRecipe(args: { id: string }): Promise<ToolResult> {
  await apiDelete(`/recipes/${args.id}`);
  return ok({ deleted: true });
}

export async function importRecipe(args: { url: string }): Promise<ToolResult> {
  const data = await apiPost("/import/preview", { url: args.url });
  return ok(data);
}

export async function toggleFavourite(args: { id: string }): Promise<ToolResult> {
  const data = await apiPost(`/recipes/${args.id}/favourite`);
  return ok(data);
}

export async function listMealPlans(): Promise<ToolResult> {
  const data = await apiGet("/meal-plans");
  return ok(data);
}

export async function createMealPlan(args: { name?: string }): Promise<ToolResult> {
  const data = await apiPost("/meal-plans", { name: args.name });
  return ok(data);
}

export async function deleteMealPlan(args: { id: string }): Promise<ToolResult> {
  await apiDelete(`/meal-plans/${args.id}`);
  return ok({ deleted: true });
}

export async function setMealPlanSlot(args: {
  planId: string;
  day: string;
  recipeId?: string;
  note?: string;
}): Promise<ToolResult> {
  const data = await apiPut(`/meal-plans/${args.planId}/slots/${args.day}`, {
    recipe_id: args.recipeId,
    note: args.note,
  });
  return ok(data);
}

export async function activateMealPlan(args: { id: string }): Promise<ToolResult> {
  const data = await apiPost(`/meal-plans/${args.id}/activate`);
  return ok(data);
}

export async function generateShoppingList(args: {
  planId: string;
}): Promise<ToolResult> {
  const data = await apiPost(`/meal-plans/${args.planId}/shopping-list/generate`);
  return ok(data);
}

export async function addShoppingItem(args: {
  planId: string;
  item: string;
  quantity?: number;
  unit?: string;
}): Promise<ToolResult> {
  const data = await apiPost(`/meal-plans/${args.planId}/shopping-list/items`, {
    item: args.item,
    quantity: args.quantity,
    unit: args.unit,
  });
  return ok(data);
}

export async function checkShoppingItem(args: {
  planId: string;
  itemId: string;
  checked: boolean;
}): Promise<ToolResult> {
  const data = await apiPatch(`/meal-plans/${args.planId}/shopping-list/items/${args.itemId}`, {
    checked: args.checked,
  });
  return ok(data);
}

export async function manageTags(args: {
  action: "create" | "delete";
  name?: string;
  category?: string;
  id?: string;
}): Promise<ToolResult> {
  if (args.action === "create") {
    if (!args.name) throw new Error("name is required for create action");
    const data = await apiPost("/tags", { name: args.name, category: args.category });
    return ok(data);
  }
  if (!args.id) throw new Error("id is required for delete action");
  await apiDelete(`/tags/${args.id}`);
  return ok({ deleted: true });
}
