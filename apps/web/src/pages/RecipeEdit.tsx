import { getRouteApi, useNavigate } from "@tanstack/react-router";

const Route = getRouteApi("/recipes/$id/edit");
import type { RecipeCreate as RecipeCreatePayload } from "@api/schemas";
import { useState } from "react";
import { useRecipe, useUpdateRecipe } from "../api/queries";
import { Page } from "../components/Page";
import { RecipeForm, detailToFormValues } from "../components/RecipeForm";
import { RecipeDetailSkeleton } from "../components/Skeleton";

export function RecipeEdit() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading, error } = useRecipe(id);
  const updateRecipe = useUpdateRecipe(id);
  const [serverError, setServerError] = useState<string | undefined>();

  const handleSubmit = async (data: RecipeCreatePayload) => {
    setServerError(undefined);
    try {
      await updateRecipe.mutateAsync(data);
      navigate({ to: "/recipes/$id", params: { id } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update recipe");
    }
  };

  if (isLoading) {
    return (
      <Page className="py-4">
        <RecipeDetailSkeleton />
      </Page>
    );
  }

  if (error || !recipe) {
    return (
      <Page className="py-8">
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-6 text-center">
          <p className="text-red-700 dark:text-red-300 font-medium">Recipe not found</p>
        </div>
      </Page>
    );
  }

  return (
    <Page className="py-4">
      <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-6">
        Edit: {recipe.title}
      </h1>
      <RecipeForm
        defaultValues={detailToFormValues(recipe)}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        serverError={serverError}
      />
    </Page>
  );
}
