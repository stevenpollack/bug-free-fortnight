import type { RecipeCreate, RecipeUpdate } from "@api/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getAnthropicKey } from "../lib/anthropicKey";
import { ApiError, client, unwrap } from "./client";
import type {
  AppConfig,
  DayKey,
  ShoppingList,
  ShoppingListItem,
  ShoppingListResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  recipes: (params: { q?: string; tag?: string[]; favourite?: boolean }) =>
    ["recipes", params] as const,
  recipe: (id: string) => ["recipe", id] as const,
  tags: () => ["tags"] as const,
  mealPlans: () => ["meal-plans"] as const,
  mealPlan: (id: string) => ["meal-plans", id] as const,
  shoppingList: (planId: string) => ["shopping-list", planId] as const,
  recipeSchema: () => ["schema", "recipe"] as const,
  mealPlanSchema: () => ["schema", "meal-plan"] as const,
};

// ---------------------------------------------------------------------------
// App config
// ---------------------------------------------------------------------------

export function useAppConfig() {
  return useQuery({
    queryKey: ["config"] as const,
    queryFn: () => client.api.config.$get().then((res) => unwrap<AppConfig>(res)),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/**
 * Returns true when AI generation can be used — either the server has an API
 * key configured or the user has saved their own key in localStorage.
 */
export function useCanGenerate(): boolean {
  const { data } = useAppConfig();
  const localKey = useSyncExternalStore(subscribe, getAnthropicKey, () => null);
  return data?.features.recipeGeneration === true || Boolean(localKey);
}

/** Mutation to test an Anthropic API key against our backend. */
export function useTestAnthropicKey() {
  return useMutation({
    mutationFn: (key: string) =>
      client.api.anthropic["test-key"]
        .$post({}, { headers: { "X-Anthropic-Key": key } })
        .then((res) => unwrap<{ ok: boolean }>(res)),
  });
}

// ---------------------------------------------------------------------------
// Recipe queries
// ---------------------------------------------------------------------------

export function useRecipesList(params: { q?: string; tag?: string[]; favourite?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.recipes(params),
    queryFn: async () => {
      const query: Record<string, string | string[]> = {};
      if (params.q) query.q = params.q;
      if (params.tag?.length) query.tag = params.tag;
      if (params.favourite !== undefined) query.favourite = String(params.favourite);
      const res = await client.api.recipes.$get({ query });
      return unwrap<{ recipes: import("./types").RecipeListItem[] }>(res);
    },
    select: (data) => data.recipes,
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: queryKeys.recipe(id),
    queryFn: async () => {
      const res = await client.api.recipes[":id"].$get({ param: { id } });
      return unwrap<{ recipe: import("./types").RecipeDetail }>(res);
    },
    select: (data) => data.recipe,
  });
}

// ---------------------------------------------------------------------------
// Tag queries
// ---------------------------------------------------------------------------

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags(),
    queryFn: async () => {
      const res = await client.api.tags.$get();
      return unwrap<{ tags: import("./types").Tag[] }>(res);
    },
    select: (data) => data.tags,
  });
}

// ---------------------------------------------------------------------------
// Recipe mutations
// ---------------------------------------------------------------------------

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: RecipeCreate) => {
      const res = await client.api.recipes.$post({ json: body });
      return unwrap<{ recipe: import("./types").RecipeDetail }>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUpdateRecipe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: RecipeUpdate) => {
      const res = await client.api.recipes[":id"].$put({ param: { id }, json: body });
      return unwrap<{ recipe: import("./types").RecipeDetail }>(res);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.setQueryData(queryKeys.recipe(id), data);
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.recipes[":id"].$delete({ param: { id } });
      return unwrap<void>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useToggleFavourite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.recipes[":id"].favourite.$post({ param: { id } });
      return unwrap<{ recipe: import("./types").RecipeDetail }>(res);
    },
    onSuccess: (data, id) => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.setQueryData(queryKeys.recipe(id), data);
    },
  });
}

// ---------------------------------------------------------------------------
// Tag mutations
// ---------------------------------------------------------------------------

export function useUpsertTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; category?: string | null }) => {
      const res = await client.api.tags.$post({ json: body });
      return unwrap<{ tag: import("./types").Tag }>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tags() });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.tags[":id"].$delete({ param: { id } });
      return unwrap<void>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tags() });
    },
  });
}

// ---------------------------------------------------------------------------
// Import mutation
// ---------------------------------------------------------------------------

export function useImportPreview() {
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await client.api.import.preview.$post({ json: { url } });
      return unwrap<import("./types").ImportResult>(res);
    },
  });
}

// ---------------------------------------------------------------------------
// Generate recipe mutation
// ---------------------------------------------------------------------------

export function useGenerateRecipe() {
  return useMutation({
    mutationFn: async (body: { prompt: string; servings?: number; dietary?: string }) => {
      const res = await client.api.recipes.generate.$post({ json: body });
      return unwrap<{ recipe: RecipeCreate }>(res);
    },
  });
}

// ---------------------------------------------------------------------------
// Meal plan queries
// ---------------------------------------------------------------------------

export function useMealPlansList() {
  return useQuery({
    queryKey: queryKeys.mealPlans(),
    queryFn: async () => {
      const res = await client.api["meal-plans"].$get();
      return unwrap<{ mealPlans: import("./types").MealPlanListItem[] }>(res);
    },
    select: (data) => data.mealPlans,
  });
}

export function useMealPlan(id: string) {
  return useQuery({
    queryKey: queryKeys.mealPlan(id),
    queryFn: async () => {
      const res = await client.api["meal-plans"][":id"].$get({ param: { id } });
      return unwrap<{ mealPlan: import("./types").MealPlanDetail }>(res);
    },
    select: (data) => data.mealPlan,
  });
}

// ---------------------------------------------------------------------------
// Meal plan mutations
// ---------------------------------------------------------------------------

export function useCreateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name?: string | null) => {
      const res = await client.api["meal-plans"].$post({ json: { name: name ?? null } });
      return unwrap<{ mealPlan: import("./types").MealPlanDetail }>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
    },
  });
}

export function useUpdateMealPlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name?: string | null }) => {
      const res = await client.api["meal-plans"][":id"].$patch({ param: { id }, json: body });
      return unwrap<{ mealPlan: import("./types").MealPlanDetail }>(res);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
      qc.setQueryData(queryKeys.mealPlan(id), data);
    },
  });
}

export function useDeleteMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api["meal-plans"][":id"].$delete({ param: { id } });
      return unwrap<void>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
    },
  });
}

export function useActivateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api["meal-plans"][":id"].activate.$post({ param: { id } });
      return unwrap<{ mealPlan: import("./types").MealPlanDetail }>(res);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
      qc.setQueryData(queryKeys.mealPlan(data.mealPlan.id), data);
    },
  });
}

export function useUpsertSlot(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      day,
      body,
    }: {
      day: DayKey;
      body: { recipe_id?: string | null; note?: string | null };
    }) => {
      const res = await client.api["meal-plans"][":id"].slots[":day"].$put({
        param: { id: planId, day },
        json: body,
      });
      return unwrap<{ mealPlan: import("./types").MealPlanDetail }>(res);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
      qc.setQueryData(queryKeys.mealPlan(planId), data);
      // Invalidate the shopping list so staleness indicator refreshes
      qc.invalidateQueries({ queryKey: queryKeys.shoppingList(planId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Shopping list queries
// ---------------------------------------------------------------------------

export function useShoppingList(planId: string) {
  return useQuery({
    queryKey: queryKeys.shoppingList(planId),
    queryFn: async () => {
      const res = await client.api["meal-plans"][":id"]["shopping-list"].$get({
        param: { id: planId },
      });
      return unwrap<ShoppingListResponse>(res);
    },
  });
}

// ---------------------------------------------------------------------------
// Shopping list mutations
// ---------------------------------------------------------------------------

export function useGenerateShoppingList(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await client.api["meal-plans"][":id"]["shopping-list"].generate.$post({
        param: { id: planId },
      });
      return unwrap<{ shoppingList: ShoppingList }>(res);
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.shoppingList(planId), {
        shoppingList: data.shoppingList,
        // plan_updated_at not returned by generate; trigger a full refetch
        plan_updated_at: data.shoppingList.plan_snapshot_at,
      });
    },
  });
}

export function useToggleShoppingListItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const res = await client.api["meal-plans"][":id"]["shopping-list"].items[":itemId"].$patch({
        param: { id: planId, itemId },
        json: { checked },
      });
      return unwrap<{ item: ShoppingListItem }>(res);
    },
    // Optimistic update
    onMutate: async ({ itemId, checked }) => {
      await qc.cancelQueries({ queryKey: queryKeys.shoppingList(planId) });
      const previous = qc.getQueryData(queryKeys.shoppingList(planId));
      qc.setQueryData(queryKeys.shoppingList(planId), (old: ShoppingListResponse | undefined) => {
        if (!old?.shoppingList) return old;
        return {
          ...old,
          shoppingList: {
            ...old.shoppingList,
            items: old.shoppingList.items.map((item) =>
              item.id === itemId ? { ...item, checked } : item,
            ),
          },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.shoppingList(planId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shoppingList(planId) });
    },
  });
}

export function usePatchShoppingListItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      body,
    }: {
      itemId: string;
      body: {
        item?: string;
        quantity?: number | null;
        unit?: string | null;
        notes?: string | null;
      };
    }) => {
      const res = await client.api["meal-plans"][":id"]["shopping-list"].items[":itemId"].$patch({
        param: { id: planId, itemId },
        json: body,
      });
      return unwrap<{ item: ShoppingListItem }>(res);
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.shoppingList(planId), (old: ShoppingListResponse | undefined) => {
        if (!old?.shoppingList) return old;
        return {
          ...old,
          shoppingList: {
            ...old.shoppingList,
            items: old.shoppingList.items.map((item: ShoppingListItem) =>
              item.id === data.item.id ? data.item : item,
            ),
          },
        };
      });
    },
  });
}

export function useDeleteShoppingListItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await client.api["meal-plans"][":id"]["shopping-list"].items[":itemId"].$delete({
        param: { id: planId, itemId },
      });
      return unwrap<void>(res);
    },
    onSuccess: (_data, itemId) => {
      qc.setQueryData(queryKeys.shoppingList(planId), (old: ShoppingListResponse | undefined) => {
        if (!old?.shoppingList) return old;
        return {
          ...old,
          shoppingList: {
            ...old.shoppingList,
            items: old.shoppingList.items.filter((item: ShoppingListItem) => item.id !== itemId),
          },
        };
      });
    },
  });
}

export function useAddShoppingListItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      item: string;
      quantity?: number | null;
      unit?: string | null;
      notes?: string | null;
    }) => {
      const res = await client.api["meal-plans"][":id"]["shopping-list"].items.$post({
        param: { id: planId },
        json: body,
      });
      return unwrap<{ item: ShoppingListItem }>(res);
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.shoppingList(planId), (old: ShoppingListResponse | undefined) => {
        if (!old?.shoppingList) return old;
        return {
          ...old,
          shoppingList: {
            ...old.shoppingList,
            items: [...old.shoppingList.items, data.item],
          },
        };
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Schema queries
// ---------------------------------------------------------------------------

export function useRecipeSchema() {
  return useQuery({
    queryKey: queryKeys.recipeSchema(),
    queryFn: async () => {
      const res = await client.api.schemas.recipe.$get();
      return unwrap<Record<string, unknown>>(res);
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useMealPlanSchema() {
  return useQuery({
    queryKey: queryKeys.mealPlanSchema(),
    queryFn: async () => {
      const res = await client.api.schemas["meal-plan"].$get();
      return unwrap<Record<string, unknown>>(res);
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// ---------------------------------------------------------------------------
// Meal plan generation mutation
// ---------------------------------------------------------------------------

export function useGenerateMealPlan(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { prompt: string } | { rawJson: string }) => {
      const res = await client.api["meal-plans"].generate.$post({
        json: { planId, ...body },
      });
      return unwrap<{ ok: boolean; slotCount: number }>(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlan(planId) });
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

// Re-export ApiError so call sites don't need to import from two places
export { ApiError };
