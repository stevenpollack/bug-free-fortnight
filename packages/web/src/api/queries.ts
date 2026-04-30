import type { RecipeCreate, RecipeUpdate } from "@api/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayKey } from "./client";
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
    },
  });
}
