import type { RecipeCreate as RecipeCreatePayload } from "@api/schemas";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useCreateRecipe } from "../api/queries";
import { Page } from "../components/Page";
import { RecipeForm, defaultFormValues, recipeCreateToFormValues } from "../components/RecipeForm";

export function RecipeCreate() {
  const navigate = useNavigate();
  const createRecipe = useCreateRecipe();
  const [serverError, setServerError] = useState<string | undefined>();

  // Read generated recipe from router state (set by GenerateRecipeSheet)
  const { location } = useRouterState();
  const locationState = location.state as { generatedRecipe?: RecipeCreatePayload } | undefined;
  const generatedRecipe = locationState?.generatedRecipe;

  const handleSubmit = async (data: RecipeCreatePayload) => {
    setServerError(undefined);
    try {
      const result = await createRecipe.mutateAsync(data);
      navigate({ to: "/recipes/$id", params: { id: result.recipe.id } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save recipe");
    }
  };

  return (
    <Page className="py-4">
      <Link
        to="/"
        className="text-sm text-(--recipe-muted) hover:text-(--recipe-text) transition-colors mb-2 inline-block"
      >
        ← Recipes
      </Link>
      <h1 className="text-xl font-bold text-(--recipe-text) mb-6">New Recipe</h1>
      <RecipeForm
        defaultValues={
          generatedRecipe ? recipeCreateToFormValues(generatedRecipe) : defaultFormValues()
        }
        onSubmit={handleSubmit}
        submitLabel="Create Recipe"
        serverError={serverError}
      />
    </Page>
  );
}
