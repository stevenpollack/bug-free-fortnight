import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "./api.js";

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
  const data = await apiGet("/recipes");
  return jsonResource("recipes://list", data);
}

export async function readTagsList(): Promise<ResourceResult> {
  const data = await apiGet("/tags");
  return jsonResource("tags://list", data);
}

export async function readRecipeSchema(): Promise<ResourceResult> {
  const data = await apiGet("/schemas/recipe");
  return jsonResource("schemas://recipe", data);
}

export async function readMealPlanSchema(): Promise<ResourceResult> {
  const data = await apiGet("/schemas/meal-plan");
  return jsonResource("schemas://meal-plan", data);
}

// ---------------------------------------------------------------------------
// Template resources
// ---------------------------------------------------------------------------

export const recipeTemplate = new ResourceTemplate("recipes://{id}", {
  list: undefined,
});

export async function readRecipe(
  uri: URL,
  vars: Record<string, string | string[]>,
): Promise<ResourceResult> {
  const id = Array.isArray(vars.id) ? vars.id[0] : vars.id;
  const data = await apiGet(`/recipes/${id}`);
  return jsonResource(uri.toString(), data);
}

export const mealPlanTemplate = new ResourceTemplate("meal-plans://{id}", {
  list: undefined,
});

export async function readMealPlan(
  uri: URL,
  vars: Record<string, string | string[]>,
): Promise<ResourceResult> {
  const id = Array.isArray(vars.id) ? vars.id[0] : vars.id;
  const data = await apiGet(`/meal-plans/${id}`);
  return jsonResource(uri.toString(), data);
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
  const data = await apiGet(`/meal-plans/${id}/shopping-list`);
  return jsonResource(uri.toString(), data);
}
