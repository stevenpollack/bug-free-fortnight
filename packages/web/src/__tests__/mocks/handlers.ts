import { http, HttpResponse } from "msw";

// ---------------------------------------------------------------------------
// Canned data
// ---------------------------------------------------------------------------

export const PLAN_ID = "plan-test-id";
export const PLAN_ID_2 = "plan-test-id-2";

export const mockPlanDetail = {
  id: PLAN_ID,
  name: "Test Week",
  is_active: true,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  slots: {
    mon: {
      recipe_id: "recipe-1",
      recipe_title: "Pasta Carbonara",
      recipe_image_url: null,
      note: null,
    },
    tue: null,
    wed: null,
    thu: null,
    fri: null,
    sat: null,
    sun: null,
  },
};

export const mockPlanList = [
  { id: PLAN_ID, name: "Test Week", is_active: true, created_at: "2026-04-01T00:00:00.000Z" },
  { id: PLAN_ID_2, name: "Another Plan", is_active: false, created_at: "2026-03-01T00:00:00.000Z" },
];

export const mockShoppingItems = [
  {
    id: "item-1",
    display_order: 1,
    item: "Spaghetti",
    quantity: 200,
    unit: "g",
    checked: false,
    custom: false,
    notes: null,
  },
  {
    id: "item-2",
    display_order: 2,
    item: "Eggs",
    quantity: 4,
    unit: null,
    checked: false,
    custom: false,
    notes: null,
  },
];

export const mockShoppingList = {
  id: "list-1",
  plan_id: PLAN_ID,
  generated_at: "2026-04-01T10:00:00.000Z",
  plan_snapshot_at: "2026-04-01T10:00:00.000Z",
  items: mockShoppingItems,
};

export const mockRecipes = [
  {
    id: "recipe-1",
    title: "Pasta Carbonara",
    description: "Classic Italian pasta",
    sourceUrl: null,
    imageUrl: null,
    baseServings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    notes: null,
    instructions: [],
    favourite: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    tagIds: [],
  },
  {
    id: "recipe-2",
    title: "Chicken Soup",
    description: "Warming chicken soup",
    sourceUrl: null,
    imageUrl: null,
    baseServings: 6,
    prepTimeMinutes: 15,
    cookTimeMinutes: 45,
    notes: null,
    instructions: [],
    favourite: true,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    tagIds: [],
  },
];

// ---------------------------------------------------------------------------
// Default happy-path handlers
// ---------------------------------------------------------------------------

export const mockGeneratedRecipe = {
  title: "Generated Pasta",
  description: "An AI-generated pasta",
  baseServings: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  instructions: ["Boil water", "Cook pasta"],
  ingredients: [{ item: "pasta", quantity: 200, unit: "g", originalLine: "200g pasta" }],
  favourite: false,
  tagIds: [],
};

export const handlers = [
  // App config — generation enabled by default
  http.get("*/api/config", () => {
    return HttpResponse.json({ features: { recipeGeneration: true } });
  }),

  // Recipe generation
  http.post("*/api/recipes/generate", () => {
    return HttpResponse.json({ recipe: mockGeneratedRecipe });
  }),

  // Meal plans list
  http.get("*/api/meal-plans", () => {
    return HttpResponse.json({ mealPlans: mockPlanList });
  }),

  // Meal plan detail
  http.get("*/api/meal-plans/:id", ({ params }) => {
    if (params.id === PLAN_ID) {
      return HttpResponse.json({ mealPlan: mockPlanDetail });
    }
    return HttpResponse.json(
      { error: { code: "NOT_FOUND", message: "Not found" } },
      { status: 404 },
    );
  }),

  // Shopping list (null by default — no list generated yet)
  http.get("*/api/meal-plans/:id/shopping-list", () => {
    return HttpResponse.json({
      shoppingList: null,
      plan_updated_at: "2026-04-01T00:00:00.000Z",
    });
  }),

  // Generate shopping list
  http.post("*/api/meal-plans/:id/shopping-list/generate", () => {
    return HttpResponse.json({ shoppingList: mockShoppingList });
  }),

  // Patch shopping list item
  http.patch(
    "*/api/meal-plans/:planId/shopping-list/items/:itemId",
    async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const item = mockShoppingItems.find((i) => i.id === params.itemId) ?? mockShoppingItems[0];
      return HttpResponse.json({ item: { ...item, ...body } });
    },
  ),

  // Delete shopping list item
  http.delete("*/api/meal-plans/:planId/shopping-list/items/:itemId", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Add shopping list item
  http.post("*/api/meal-plans/:planId/shopping-list/items", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newItem = {
      id: "item-new",
      display_order: 99,
      item: String(body.item),
      quantity: null,
      unit: null,
      checked: false,
      custom: true,
      notes: null,
    };
    return HttpResponse.json({ item: newItem });
  }),

  // Create meal plan
  http.post("*/api/meal-plans", () => {
    return HttpResponse.json({
      mealPlan: {
        id: "plan-new",
        name: null,
        is_active: false,
        created_at: "2026-04-30T00:00:00.000Z",
        updated_at: "2026-04-30T00:00:00.000Z",
        slots: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
      },
    });
  }),

  // Delete meal plan
  http.delete("*/api/meal-plans/:id", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Activate meal plan
  http.post("*/api/meal-plans/:id/activate", ({ params }) => {
    return HttpResponse.json({
      mealPlan: { ...mockPlanDetail, id: String(params.id), is_active: true },
    });
  }),

  // Update meal plan
  http.patch("*/api/meal-plans/:id", async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      mealPlan: { ...mockPlanDetail, id: String(params.id), ...body },
    });
  }),

  // Recipes list
  http.get("*/api/recipes", () => {
    return HttpResponse.json({ recipes: mockRecipes });
  }),

  // Recipe detail
  http.get("*/api/recipes/:id", ({ params }) => {
    const recipe = mockRecipes.find((r) => r.id === params.id);
    if (!recipe) {
      return HttpResponse.json(
        { error: { code: "NOT_FOUND", message: "Not found" } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ recipe: { ...recipe, ingredients: [] } });
  }),

  // Tags
  http.get("*/api/tags", () => {
    return HttpResponse.json({ tags: [] });
  }),

  // Recipe schema
  http.get("*/api/schemas/recipe", () => {
    return HttpResponse.json({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        ingredients: { type: "array", items: { type: "object" } },
        instructions: { type: "array", items: { type: "string" } },
      },
      required: ["title"],
    });
  }),

  // Client-side log endpoint
  http.post("*/api/log", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
