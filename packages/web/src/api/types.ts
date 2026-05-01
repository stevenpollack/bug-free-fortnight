import type { InferResponseType } from "hono/client";
import type { client } from "./client";

// Convenience aliases for deeply-nested client properties that cannot use
// dot syntax (hyphenated segments) in typeof expressions.
type ApiClient = typeof client.api;
type MealPlansClient = ApiClient["meal-plans"];
type MealPlanByIdClient = MealPlansClient[":id"];
type ShoppingListClient = MealPlanByIdClient["shopping-list"];

// ---------------------------------------------------------------------------
// Recipe types — inferred from API route responses
// ---------------------------------------------------------------------------

type RecipesGetResponse = InferResponseType<ApiClient["recipes"]["$get"], 200>;
export type RecipeListItem = RecipesGetResponse["recipes"][number];

type RecipeGetResponse = InferResponseType<ApiClient["recipes"][":id"]["$get"], 200>;
export type RecipeDetail = RecipeGetResponse["recipe"];
export type Ingredient = RecipeDetail["ingredients"][number];

// ---------------------------------------------------------------------------
// Tag types
// ---------------------------------------------------------------------------

type TagsGetResponse = InferResponseType<ApiClient["tags"]["$get"], 200>;
export type Tag = TagsGetResponse["tags"][number];

// ---------------------------------------------------------------------------
// Import types
// ---------------------------------------------------------------------------

type ImportPreviewResponse = InferResponseType<ApiClient["import"]["preview"]["$post"], 200>;
export type ImportResult = ImportPreviewResponse;

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

// config route has no zValidator so hono cannot statically infer the response
// body — define it manually to match the handler shape.
export interface AppConfig {
  features: {
    recipeGeneration: boolean;
  };
}

// ---------------------------------------------------------------------------
// Meal plan types
// ---------------------------------------------------------------------------

type MealPlansGetResponse = InferResponseType<MealPlansClient["$get"], 200>;
export type MealPlanListItem = MealPlansGetResponse["mealPlans"][number];

type MealPlanGetResponse = InferResponseType<MealPlanByIdClient["$get"], 200>;
export type MealPlanDetail = MealPlanGetResponse["mealPlan"];
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type MealPlanSlot = NonNullable<MealPlanDetail["slots"][DayKey]>;
export type SlotsMap = MealPlanDetail["slots"];

// ---------------------------------------------------------------------------
// Shopping list types
// ---------------------------------------------------------------------------

type ShoppingListGenerateResponse = InferResponseType<ShoppingListClient["generate"]["$post"], 201>;
export type ShoppingList = ShoppingListGenerateResponse["shoppingList"];
export type ShoppingListItem = ShoppingList["items"][number];

type ShoppingListGetResponse = InferResponseType<ShoppingListClient["$get"], 200>;
export type ShoppingListResponse = ShoppingListGetResponse;
