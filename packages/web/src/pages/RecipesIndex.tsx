import type { RecipeCreate } from "@api/schemas";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppConfig, useRecipesList, useTags } from "../api/queries";
import { GenerateRecipeSheet } from "../components/GenerateRecipeSheet";
import { Page } from "../components/Page";
import { RecipeCardSkeleton } from "../components/Skeleton";
import { TagPill } from "../components/TagPill";
import { ClockIcon, PlusIcon, SearchIcon, SparklesIcon, StarIcon } from "../components/icons";

const Route = getRouteApi("/");

// Search params shape matching the route's validateSearch schema
type SearchParams = { q?: string; tag?: string[]; favourite?: boolean };

export function RecipesIndex() {
  // Cast needed: TanStack Router returns a union type including {} for routes without search
  const search = Route.useSearch() as SearchParams;
  const navigate = useNavigate({ from: "/" });
  const [localQ, setLocalQ] = useState(search.q ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    data: recipes,
    isLoading,
    error,
  } = useRecipesList({
    q: search.q,
    tag: search.tag,
    favourite: search.favourite || undefined,
  });
  const { data: allTags = [] } = useTags();
  const { data: appConfig } = useAppConfig();

  const tagMap = new Map(allTags.map((t) => [t.id, t]));

  // Debounce-free approach: update URL on blur / Enter
  const applySearch = (q: string) => {
    navigate({
      search: (prev) => ({ ...prev, q: q || undefined }),
      replace: true,
    });
  };

  const toggleTag = (tagId: string) => {
    const current = search.tag ?? [];
    const next = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    navigate({
      search: (prev) => ({ ...prev, tag: next.length > 0 ? next : undefined }),
      replace: true,
    });
  };

  const toggleFavourite = () => {
    const currentFav = search.favourite;
    navigate({
      to: "/",
      search: { ...search, favourite: currentFav ? undefined : true },
      replace: true,
    });
  };

  const handleGenerated = (recipe: RecipeCreate) => {
    setSheetOpen(false);
    // Pass generated recipe via router state so RecipeCreate can pre-fill the form.
    // Cast needed: HistoryState is an open extension point but lacks user-defined fields.
    navigate({
      to: "/recipes/new",
      state: { generatedRecipe: recipe } as unknown as Parameters<typeof navigate>[0]["state"],
    });
  };

  const generationEnabled = appConfig?.features.recipeGeneration === true;

  return (
    <Page className="py-2">
      {/* Search */}
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-(--recipe-muted) pointer-events-none" />
        <input
          type="search"
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
          onBlur={() => applySearch(localQ)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applySearch(localQ);
          }}
          placeholder="Search recipes…"
          className="block w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) pl-10 pr-4 py-3 text-base text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30"
        />
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none mb-2">
          {allTags.map((tag) => {
            const active = (search.tag ?? []).includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors min-h-9 ${
                  active
                    ? "bg-(--recipe-primary) text-(--recipe-primary-text)"
                    : "bg-(--recipe-surface-raised) text-(--recipe-muted) hover:bg-(--recipe-chip-bg) hover:text-(--recipe-chip-text)"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Favourites toggle */}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={toggleFavourite}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors min-h-9 ${
            search.favourite
              ? "bg-(--recipe-chip-bg) text-(--recipe-chip-text)"
              : "text-(--recipe-muted) hover:text-(--recipe-primary)"
          }`}
        >
          <StarIcon className="size-4" filled={search.favourite} />
          Favourites only
        </button>
      </div>

      {/* Action row */}
      <div className="flex gap-2 mb-4 md:justify-end">
        <Link
          to="/recipes/new"
          className={`flex items-center justify-center gap-2 rounded-xl bg-(--recipe-primary) hover:bg-[#b8c59f] active:bg-[#97a67d] text-(--recipe-primary-text) font-semibold px-4 py-3 text-sm transition-colors min-h-11 ${generationEnabled ? "flex-1 md:flex-none" : "flex-1 md:flex-none"}`}
        >
          <PlusIcon className="size-4" />
          New Recipe
        </Link>
        {generationEnabled && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl border border-(--recipe-border) text-(--recipe-muted) hover:border-(--recipe-accent) hover:text-(--recipe-text) font-medium px-4 py-3 text-sm transition-colors min-h-11 bg-(--recipe-surface)"
          >
            <SparklesIcon className="size-4" />
            Generate
          </button>
        )}
      </div>

      {/* Recipe list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-[#2f1f1b] border border-(--recipe-destructive) p-6 text-center">
          <p className="text-(--recipe-destructive) font-medium">Failed to load recipes</p>
          <p className="text-sm text-[#e6a092] mt-1">{(error as Error).message}</p>
        </div>
      ) : recipes?.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-(--recipe-border) p-10 text-center">
          <p className="text-(--recipe-muted) mb-4">
            {search.q || (search.tag ?? []).length > 0 || search.favourite
              ? "No recipes match your filters"
              : "No recipes yet — add your first one!"}
          </p>
          {!search.q && !(search.tag ?? []).length && !search.favourite && (
            <Link
              to="/recipes/new"
              className="inline-flex items-center gap-2 rounded-xl bg-(--recipe-primary) px-5 py-3 text-(--recipe-primary-text) font-semibold hover:bg-[#b8c59f] transition-colors"
            >
              <PlusIcon className="size-5" />
              Add Recipe
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {recipes?.map((recipe) => {
            const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
            const recipeTags = recipe.tagIds.map((id) => tagMap.get(id)).filter(Boolean);
            return (
              <Link
                key={recipe.id}
                to="/recipes/$id"
                params={{ id: recipe.id }}
                className="flex gap-3 rounded-xl border border-(--recipe-border) bg-(--recipe-surface) p-4 hover:border-(--recipe-accent) transition-colors active:bg-(--recipe-surface-raised)"
              >
                {/* Thumbnail */}
                {recipe.imageUrl && (
                  <img
                    src={recipe.imageUrl}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-(--recipe-text) leading-snug line-clamp-2">
                      {recipe.title}
                    </h2>
                    {recipe.favourite && (
                      <StarIcon className="size-4 text-(--recipe-accent) shrink-0 mt-0.5" filled />
                    )}
                  </div>

                  {totalMins > 0 && (
                    <p className="flex items-center gap-1 text-xs text-(--recipe-muted) mt-1">
                      <ClockIcon className="size-3.5" />
                      {totalMins} min
                    </p>
                  )}

                  {recipeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recipeTags
                        .slice(0, 4)
                        .map((tag) => (tag ? <TagPill key={tag.id} tag={tag} /> : null))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Generate Recipe Sheet */}
      <GenerateRecipeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onGenerated={handleGenerated}
      />
    </Page>
  );
}
