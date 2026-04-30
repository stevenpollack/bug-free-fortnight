import type { RecipeCreate as RecipeCreatePayload } from "@api/schemas";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCreateRecipe } from "../api/queries";
import { Page } from "../components/Page";
import { RecipeForm, defaultFormValues } from "../components/RecipeForm";

export function RecipeCreate() {
  const navigate = useNavigate();
  const createRecipe = useCreateRecipe();
  const [serverError, setServerError] = useState<string | undefined>();

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
      <h1 className="text-xl font-bold text-(--recipe-text) mb-6">New Recipe</h1>
      <RecipeForm
        defaultValues={defaultFormValues()}
        onSubmit={handleSubmit}
        submitLabel="Create Recipe"
        serverError={serverError}
      />
    </Page>
  );
}
