import type { RecipeCreate as RecipeCreatePayload } from "@api/schemas";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCreateRecipe, useImportPreview } from "../api/queries";
import { Page } from "../components/Page";
import { RecipeForm, recipeCreateToFormValues } from "../components/RecipeForm";
import { AlertIcon, DownloadIcon, XIcon } from "../components/icons";

export function ImportFlow() {
  const navigate = useNavigate();
  const importPreview = useImportPreview();
  const createRecipe = useCreateRecipe();

  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | undefined>();
  const [dismissedWarnings, setDismissedWarnings] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("Please enter a URL");
      return;
    }
    setUrlError(undefined);
    setDismissedWarnings(false);
    importPreview.mutate(trimmed);
  };

  const handleSave = async (data: RecipeCreatePayload) => {
    setServerError(undefined);
    try {
      const result = await createRecipe.mutateAsync(data);
      navigate({ to: "/recipes/$id", params: { id: result.recipe.id } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save recipe");
    }
  };

  const preview = importPreview.data;
  const warnings = preview?.warnings ?? [];
  const showWarnings = warnings.length > 0 && !dismissedWarnings;

  return (
    <Page className="py-4">
      {/* URL input form */}
      {!preview ? (
        <div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            Import from RecipeTin Eats
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
            Paste a RecipeTin Eats recipe URL to import ingredients and instructions automatically.
          </p>

          <form onSubmit={handlePreview} className="space-y-4">
            <div>
              <label
                htmlFor="import-url"
                className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
              >
                Recipe URL
              </label>
              <input
                id="import-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.recipetineats.com/..."
                autoComplete="url"
                inputMode="url"
                className="block w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-3 py-2.5 text-base placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:text-stone-100"
              />
              {urlError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{urlError}</p>
              )}
            </div>

            {importPreview.isError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {(importPreview.error as Error).message}
                </p>
              </div>
            )}

            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur py-3 -mx-4 px-4 border-t border-stone-200 dark:border-stone-700 md:border-none md:bg-transparent md:backdrop-blur-none md:py-0 md:mx-0 md:px-0">
              <button
                type="submit"
                disabled={importPreview.isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-60 text-white font-semibold py-3.5 text-base transition-colors min-h-14"
              >
                <DownloadIcon className="size-5" />
                {importPreview.isPending ? "Fetching recipe…" : "Preview Recipe"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Review Import</h1>
            <button
              type="button"
              onClick={() => {
                importPreview.reset();
                setDismissedWarnings(false);
              }}
              className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
            >
              <XIcon className="size-4" />
              Start over
            </button>
          </div>

          {/* Import warnings */}
          {showWarnings && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertIcon className="size-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    Import warnings
                  </p>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedWarnings(true)}
                  aria-label="Dismiss warnings"
                  className="p-1 rounded text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </div>
          )}

          <RecipeForm
            defaultValues={recipeCreateToFormValues(preview.recipe)}
            onSubmit={handleSave}
            submitLabel="Save Recipe"
            serverError={serverError}
          />
        </div>
      )}
    </Page>
  );
}
