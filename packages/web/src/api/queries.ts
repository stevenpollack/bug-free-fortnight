import type { RecipeCreate, RecipeUpdate } from "@api/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayKey, ShoppingList, ShoppingListItem } from "./client";
import { client } from "./client";

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
};

// ---------------------------------------------------------------------------
// Recipe queries
// ---------------------------------------------------------------------------

export function useRecipesList(params: { q?: string; tag?: string[]; favourite?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.recipes(params),
    queryFn: () => client.getRecipes(params),
    select: (data) => data.recipes,
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: queryKeys.recipe(id),
    queryFn: () => client.getRecipe(id),
    select: (data) => data.recipe,
  });
}

// ---------------------------------------------------------------------------
// Tag queries
// ---------------------------------------------------------------------------

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags(),
    queryFn: () => client.getTags(),
    select: (data) => data.tags,
  });
}

// ---------------------------------------------------------------------------
// Recipe mutations
// ---------------------------------------------------------------------------

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecipeCreate) => client.createRecipe(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useUpdateRecipe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecipeUpdate) => client.updateRecipe(id, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.setQueryData(queryKeys.recipe(id), data);
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.deleteRecipe(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}

export function useToggleFavourite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.toggleFavourite(id),
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
    mutationFn: (body: { name: string; category?: string | null }) => client.upsertTag(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tags() });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.deleteTag(id),
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
    mutationFn: (url: string) => client.importPreview(url),
  });
}

// ---------------------------------------------------------------------------
// Meal plan queries
// ---------------------------------------------------------------------------

export function useMealPlansList() {
  return useQuery({
    queryKey: queryKeys.mealPlans(),
    queryFn: () => client.listMealPlans(),
    select: (data) => data.mealPlans,
  });
}

export function useMealPlan(id: string) {
  return useQuery({
    queryKey: queryKeys.mealPlan(id),
    queryFn: () => client.getMealPlan(id),
    select: (data) => data.mealPlan,
  });
}

// ---------------------------------------------------------------------------
// Meal plan mutations
// ---------------------------------------------------------------------------

export function useCreateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name?: string | null) => client.createMealPlan(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
    },
  });
}

export function useUpdateMealPlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string | null }) => client.updateMealPlan(id, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
      qc.setQueryData(queryKeys.mealPlan(id), data);
    },
  });
}

export function useDeleteMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.deleteMealPlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
    },
  });
}

export function useActivateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.activateMealPlan(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.mealPlans() });
      qc.setQueryData(queryKeys.mealPlan(data.mealPlan.id), data);
    },
  });
}

export function useUpsertSlot(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      day,
      body,
    }: {
      day: DayKey;
      body: { recipe_id?: string | null; note?: string | null };
    }) => client.upsertSlot(planId, day, body),
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
    queryFn: () => client.getShoppingList(planId),
  });
}

// ---------------------------------------------------------------------------
// Shopping list mutations
// ---------------------------------------------------------------------------

export function useGenerateShoppingList(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client.generateShoppingList(planId),
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
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      client.patchShoppingListItem(planId, itemId, { checked }),
    // Optimistic update
    onMutate: async ({ itemId, checked }) => {
      await qc.cancelQueries({ queryKey: queryKeys.shoppingList(planId) });
      const previous = qc.getQueryData(queryKeys.shoppingList(planId));
      qc.setQueryData(
        queryKeys.shoppingList(planId),
        (old: { shoppingList: ShoppingList | null; plan_updated_at: string } | undefined) => {
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
        },
      );
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
    mutationFn: ({
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
    }) => client.patchShoppingListItem(planId, itemId, body),
    onSuccess: (data) => {
      qc.setQueryData(
        queryKeys.shoppingList(planId),
        (old: { shoppingList: ShoppingList | null; plan_updated_at: string } | undefined) => {
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
        },
      );
    },
  });
}

export function useDeleteShoppingListItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => client.deleteShoppingListItem(planId, itemId),
    onSuccess: (_data, itemId) => {
      qc.setQueryData(
        queryKeys.shoppingList(planId),
        (old: { shoppingList: ShoppingList | null; plan_updated_at: string } | undefined) => {
          if (!old?.shoppingList) return old;
          return {
            ...old,
            shoppingList: {
              ...old.shoppingList,
              items: old.shoppingList.items.filter((item: ShoppingListItem) => item.id !== itemId),
            },
          };
        },
      );
    },
  });
}

export function useAddShoppingListItem(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      item: string;
      quantity?: number | null;
      unit?: string | null;
      notes?: string | null;
    }) => client.addShoppingListItem(planId, body),
    onSuccess: (data) => {
      qc.setQueryData(
        queryKeys.shoppingList(planId),
        (old: { shoppingList: ShoppingList | null; plan_updated_at: string } | undefined) => {
          if (!old?.shoppingList) return old;
          return {
            ...old,
            shoppingList: {
              ...old.shoppingList,
              items: [...old.shoppingList.items, data.item],
            },
          };
        },
      );
    },
  });
}
