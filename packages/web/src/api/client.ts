import type { RecipeCreate, RecipeUpdate } from "@api/schemas";
import { logger } from "../lib/logger";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// Response types (inferred from the DB schema and API routes)
// ---------------------------------------------------------------------------

export interface Tag {
  id: string;
  name: string;
  category: string | null;
}

export interface Ingredient {
  id: string;
  recipeId: string;
  displayOrder: number;
  groupHeading: string | null;
  quantity: number | null;
  unit: string | null;
  item: string;
  notes: string | null;
  originalLine: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  baseServings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  notes: string | null;
  instructions: string[];
  favourite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeListItem extends Recipe {
  tagIds: string[];
}

export interface RecipeDetail extends Recipe {
  tagIds: string[];
  ingredients: Ingredient[];
}

export interface ImportResult {
  recipe: RecipeCreate;
  warnings: string[];
}

export interface AppConfig {
  features: {
    recipeGeneration: boolean;
  };
}

// ---------------------------------------------------------------------------
// Meal planner types
// ---------------------------------------------------------------------------

export interface MealPlanSlot {
  recipe_id: string | null;
  recipe_title: string | null;
  recipe_image_url: string | null;
  note: string | null;
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type SlotsMap = Record<DayKey, MealPlanSlot | null>;

export interface MealPlanDetail {
  id: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  slots: SlotsMap;
}

export interface MealPlanListItem {
  id: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Shopping list types
// ---------------------------------------------------------------------------

export interface ShoppingListItem {
  id: string;
  display_order: number;
  item: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  custom: boolean;
  notes: string | null;
}

export interface ShoppingList {
  id: string;
  plan_id: string;
  generated_at: string;
  plan_snapshot_at: string;
  items: ShoppingListItem[];
}

export interface ShoppingListResponse {
  shoppingList: ShoppingList | null;
  plan_updated_at: string;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Core fetcher
// ---------------------------------------------------------------------------

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const json = (await res.json()) as unknown;

  if (!res.ok) {
    const body = json as { error?: { code?: string; message?: string } };
    const code = body?.error?.code ?? "UNKNOWN";
    const message = body?.error?.message ?? res.statusText;
    const err = new ApiError(res.status, code, message);
    logger.warn({ path, status: res.status, code, message }, "api error");
    throw err;
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const client = {
  // Recipes
  getRecipes(params: { q?: string; tag?: string[]; favourite?: boolean }) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    for (const t of params.tag ?? []) qs.append("tag", t);
    if (params.favourite !== undefined) qs.set("favourite", String(params.favourite));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return req<{ recipes: RecipeListItem[] }>(`/recipes${query}`);
  },

  getRecipe(id: string) {
    return req<{ recipe: RecipeDetail }>(`/recipes/${id}`);
  },

  createRecipe(body: RecipeCreate) {
    return req<{ recipe: RecipeDetail }>("/recipes", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateRecipe(id: string, body: RecipeUpdate) {
    return req<{ recipe: RecipeDetail }>(`/recipes/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  deleteRecipe(id: string) {
    return req<void>(`/recipes/${id}`, { method: "DELETE" });
  },

  toggleFavourite(id: string) {
    return req<{ recipe: RecipeDetail }>(`/recipes/${id}/favourite`, { method: "POST" });
  },

  // Tags
  getTags() {
    return req<{ tags: Tag[] }>("/tags");
  },

  upsertTag(body: { name: string; category?: string | null }) {
    return req<{ tag: Tag }>("/tags", { method: "POST", body: JSON.stringify(body) });
  },

  deleteTag(id: string) {
    return req<void>(`/tags/${id}`, { method: "DELETE" });
  },

  // Config
  getConfig() {
    return req<AppConfig>("/config");
  },

  // Generate recipe
  generateRecipe(body: { prompt: string; servings?: number; dietary?: string }) {
    return req<{ recipe: RecipeCreate }>("/recipes/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // Import
  importPreview(url: string) {
    return req<ImportResult>("/import/preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },

  // Meal plans
  listMealPlans() {
    return req<{ mealPlans: MealPlanListItem[] }>("/meal-plans");
  },

  getMealPlan(id: string) {
    return req<{ mealPlan: MealPlanDetail }>(`/meal-plans/${id}`);
  },

  createMealPlan(name?: string | null) {
    return req<{ mealPlan: MealPlanDetail }>("/meal-plans", {
      method: "POST",
      body: JSON.stringify({ name: name ?? null }),
    });
  },

  updateMealPlan(id: string, body: { name?: string | null }) {
    return req<{ mealPlan: MealPlanDetail }>(`/meal-plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteMealPlan(id: string) {
    return req<void>(`/meal-plans/${id}`, { method: "DELETE" });
  },

  activateMealPlan(id: string) {
    return req<{ mealPlan: MealPlanDetail }>(`/meal-plans/${id}/activate`, { method: "POST" });
  },

  upsertSlot(
    planId: string,
    day: DayKey,
    body: { recipe_id?: string | null; note?: string | null },
  ) {
    return req<{ mealPlan: MealPlanDetail }>(`/meal-plans/${planId}/slots/${day}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  // Shopping list
  generateShoppingList(planId: string) {
    return req<{ shoppingList: ShoppingList }>(`/meal-plans/${planId}/shopping-list/generate`, {
      method: "POST",
    });
  },

  getShoppingList(planId: string) {
    return req<ShoppingListResponse>(`/meal-plans/${planId}/shopping-list`);
  },

  patchShoppingListItem(
    planId: string,
    itemId: string,
    body: {
      checked?: boolean;
      item?: string;
      quantity?: number | null;
      unit?: string | null;
      notes?: string | null;
    },
  ) {
    return req<{ item: ShoppingListItem }>(`/meal-plans/${planId}/shopping-list/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteShoppingListItem(planId: string, itemId: string) {
    return req<void>(`/meal-plans/${planId}/shopping-list/items/${itemId}`, {
      method: "DELETE",
    });
  },

  addShoppingListItem(
    planId: string,
    body: { item: string; quantity?: number | null; unit?: string | null; notes?: string | null },
  ) {
    return req<{ item: ShoppingListItem }>(`/meal-plans/${planId}/shopping-list/items`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // Schemas
  getRecipeSchema() {
    return req<Record<string, unknown>>("/schemas/recipe");
  },

  getMealPlanSchema() {
    return req<Record<string, unknown>>("/schemas/meal-plan");
  },

  // Generate meal plan
  generateMealPlan(planId: string, body: { prompt: string } | { rawJson: string }) {
    return req<{ ok: boolean; slotCount: number }>("/meal-plans/generate", {
      method: "POST",
      body: JSON.stringify({ planId, ...body }),
    });
  },
};
