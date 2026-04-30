import type { RecipeCreate, RecipeUpdate } from "@api/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "./client";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  recipes: (params: { q?: string; tag?: string[]; favourite?: boolean }) =>
    ["recipes", params] as const,
  recipe: (id: string) => ["recipe", id] as const,
  tags: () => ["tags"] as const,
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
