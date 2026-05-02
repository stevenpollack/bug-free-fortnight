import { z } from "zod";
import { importRecipeTinEats } from "../import/recipetineats";
import { RecipeCreate, RecipeUpdate } from "../schemas/index";
import {
  activateMealPlan,
  createMealPlan,
  deleteMealPlan,
  listMealPlans,
  setMealPlanSlot,
} from "../services/mealPlans";
import {
  createRecipe,
  deleteRecipe,
  fetchFullRecipe,
  searchRecipes,
  toggleFavourite,
  updateRecipe,
} from "../services/recipes";
import { addShoppingItem, generateShoppingList, patchShoppingItem } from "../services/shoppingList";
import { createTag, deleteTag } from "../services/tags";
import { mcpLogger, withToolLog } from "./logging";

// ---------------------------------------------------------------------------
// Input schemas (re-exported so server.ts can register them)
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

export const SearchRecipesInput = {
  query: z.string().optional().describe("Full-text search term"),
  tags: z.array(z.string().uuid()).optional().describe("Filter by tag IDs"),
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
// Tool result type
// ---------------------------------------------------------------------------

type ToolResult = { content: Array<{ type: "text"; text: string }> };

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

export function searchRecipesTool(args: {
  query?: string;
  tags?: string[];
  favourite?: boolean;
}): Promise<ToolResult> {
  return withToolLog("search_recipes", async () => {
    const recipes = await searchRecipes({
      q: args.query,
      tagIds: args.tags,
      favourite: args.favourite,
    });
    return ok(recipes);
  });
}

export function getRecipeTool(args: { id: string }): Promise<ToolResult> {
  return withToolLog("get_recipe", async () => {
    const recipe = await fetchFullRecipe(args.id);
    return ok(recipe);
  });
}

export function createRecipeTool(args: {
  recipe: z.infer<typeof RecipeBody>;
}): Promise<ToolResult> {
  return withToolLog("create_recipe", async () => {
    const body = RecipeCreate.parse({
      ...args.recipe,
      baseServings: args.recipe.baseServings ?? 1,
      instructions: args.recipe.instructions ?? [],
      favourite: args.recipe.favourite ?? false,
      ingredients: args.recipe.ingredients ?? [],
      tagIds: args.recipe.tagIds ?? [],
    });
    const recipe = await createRecipe(body);
    return ok(recipe);
  });
}

export function updateRecipeTool(args: {
  id: string;
  recipe: z.infer<typeof RecipeBody>;
}): Promise<ToolResult> {
  return withToolLog("update_recipe", async () => {
    const body = RecipeUpdate.parse({
      ...args.recipe,
      baseServings: args.recipe.baseServings ?? 1,
      instructions: args.recipe.instructions ?? [],
      favourite: args.recipe.favourite ?? false,
      ingredients: args.recipe.ingredients ?? [],
      tagIds: args.recipe.tagIds ?? [],
    });
    const recipe = await updateRecipe(args.id, body);
    return ok(recipe);
  });
}

export function deleteRecipeTool(args: { id: string }): Promise<ToolResult> {
  return withToolLog("delete_recipe", async () => {
    await deleteRecipe(args.id);
    return ok({ deleted: true });
  });
}

export function importRecipeTool(args: { url: string }): Promise<ToolResult> {
  return withToolLog("import_recipe", async () => {
    const result = await importRecipeTinEats(args.url, fetch, mcpLogger);
    return ok(result);
  });
}

export function toggleFavouriteTool(args: { id: string }): Promise<ToolResult> {
  return withToolLog("toggle_favourite", async () => {
    const recipe = await toggleFavourite(args.id);
    return ok(recipe);
  });
}

export function listMealPlansTool(): Promise<ToolResult> {
  return withToolLog("list_meal_plans", async () => {
    const mealPlans = await listMealPlans();
    return ok(mealPlans);
  });
}

export function createMealPlanTool(args: { name?: string }): Promise<ToolResult> {
  return withToolLog("create_meal_plan", async () => {
    const mealPlan = await createMealPlan(args.name);
    return ok(mealPlan);
  });
}

export function deleteMealPlanTool(args: { id: string }): Promise<ToolResult> {
  return withToolLog("delete_meal_plan", async () => {
    await deleteMealPlan(args.id);
    return ok({ deleted: true });
  });
}

export function setMealPlanSlotTool(args: {
  planId: string;
  day: string;
  recipeId?: string;
  note?: string;
}): Promise<ToolResult> {
  return withToolLog("set_meal_plan_slot", async () => {
    const mealPlan = await setMealPlanSlot(args.planId, args.day, args.recipeId, args.note);
    return ok(mealPlan);
  });
}

export function activateMealPlanTool(args: { id: string }): Promise<ToolResult> {
  return withToolLog("activate_meal_plan", async () => {
    const mealPlan = await activateMealPlan(args.id);
    return ok(mealPlan);
  });
}

export function generateShoppingListTool(args: { planId: string }): Promise<ToolResult> {
  return withToolLog("generate_shopping_list", async () => {
    const shoppingList = await generateShoppingList(args.planId);
    return ok(shoppingList);
  });
}

export function addShoppingItemTool(args: {
  planId: string;
  item: string;
  quantity?: number;
  unit?: string;
}): Promise<ToolResult> {
  return withToolLog("add_shopping_item", async () => {
    const item = await addShoppingItem(args.planId, {
      item: args.item,
      quantity: args.quantity,
      unit: args.unit,
    });
    return ok(item);
  });
}

export function checkShoppingItemTool(args: {
  planId: string;
  itemId: string;
  checked: boolean;
}): Promise<ToolResult> {
  return withToolLog("check_shopping_item", async () => {
    const item = await patchShoppingItem(args.planId, args.itemId, { checked: args.checked });
    return ok(item);
  });
}

export function manageTagsTool(args: {
  action: "create" | "delete";
  name?: string;
  category?: string;
  id?: string;
}): Promise<ToolResult> {
  return withToolLog("manage_tags", async () => {
    if (args.action === "create") {
      if (!args.name) throw new Error("name is required for create action");
      const tag = await createTag(args.name, args.category);
      return ok(tag);
    }
    if (!args.id) throw new Error("id is required for delete action");
    await deleteTag(args.id);
    return ok({ deleted: true });
  });
}
