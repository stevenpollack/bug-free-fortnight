import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchPlanDetail } from "../services/mealPlans";
import { fetchFullRecipe, searchRecipes } from "../services/recipes";
import { fetchShoppingList, resolveShoppingList } from "../services/shoppingList";
import { listTags } from "../services/tags";
import { withResourceLog } from "./logging";

type ResourceResult = {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
};

function jsonResource(uri: string, data: unknown): ResourceResult {
  return {
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Static resources
// ---------------------------------------------------------------------------

export async function readRecipesList(): Promise<ResourceResult> {
  return withResourceLog("recipes://list", async () => {
    const recipes = await searchRecipes({});
    return jsonResource("recipes://list", recipes);
  });
}

export async function readTagsList(): Promise<ResourceResult> {
  return withResourceLog("tags://list", async () => {
    const tags = await listTags();
    return jsonResource("tags://list", tags);
  });
}

// Schema resources return the raw Zod-generated JSON Schema for the recipe and
// meal-plan objects. We inline them here so this module has no HTTP dependency.
export async function readRecipeSchema(): Promise<ResourceResult> {
  return withResourceLog("schemas://recipe", async () => {
    // Import lazily to avoid pulling schema logic into hot path
    const { RecipeCreate } = await import("../schemas/index");
    const schema = (RecipeCreate as unknown as { _def?: unknown })._def;
    return jsonResource("schemas://recipe", schema ?? { $ref: "RecipeCreate" });
  });
}

export async function readMealPlanSchema(): Promise<ResourceResult> {
  return withResourceLog("schemas://meal-plan", async () => {
    const { MealPlanCreate } = await import("../schemas/index");
    const schema = (MealPlanCreate as unknown as { _def?: unknown })._def;
    return jsonResource("schemas://meal-plan", schema ?? { $ref: "MealPlanCreate" });
  });
}

// ---------------------------------------------------------------------------
// Template resources
// ---------------------------------------------------------------------------

export const recipeTemplate = new ResourceTemplate("recipes://{id}", { list: undefined });

export async function readRecipe(
  uri: URL,
  vars: Record<string, string | string[]>,
): Promise<ResourceResult> {
  const id = Array.isArray(vars.id) ? vars.id[0] : vars.id;
  return withResourceLog(uri.toString(), async () => {
    const recipe = await fetchFullRecipe(id);
    return jsonResource(uri.toString(), recipe);
  });
}

export const mealPlanTemplate = new ResourceTemplate("meal-plans://{id}", { list: undefined });

export async function readMealPlan(
  uri: URL,
  vars: Record<string, string | string[]>,
): Promise<ResourceResult> {
  const id = Array.isArray(vars.id) ? vars.id[0] : vars.id;
  return withResourceLog(uri.toString(), async () => {
    const mealPlan = await fetchPlanDetail(id);
    return jsonResource(uri.toString(), mealPlan);
  });
}

export const mealPlanShoppingListTemplate = new ResourceTemplate(
  "meal-plans://{id}/shopping-list",
  { list: undefined },
);

export async function readMealPlanShoppingList(
  uri: URL,
  vars: Record<string, string | string[]>,
): Promise<ResourceResult> {
  const id = Array.isArray(vars.id) ? vars.id[0] : vars.id;
  return withResourceLog(uri.toString(), async () => {
    const { list } = await resolveShoppingList(id);
    const shoppingList = await fetchShoppingList(list.id);
    return jsonResource(uri.toString(), shoppingList);
  });
}
