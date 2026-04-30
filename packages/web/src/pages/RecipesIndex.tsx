import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useRecipesList, useTags } from "../api/queries";
import { Page } from "../components/Page";
import { RecipeCardSkeleton } from "../components/Skeleton";
import { TagPill } from "../components/TagPill";
import { ClockIcon, PlusIcon, SearchIcon, StarIcon } from "../components/icons";

const Route = getRouteApi("/");

// Search params shape matching the route's validateSearch schema
type SearchParams = { q?: string; tag?: string[]; favourite?: boolean };

export function RecipesIndex() {
  // Cast needed: TanStack Router returns a union type including {} for routes without search
  const search = Route.useSearch() as SearchParams;
  const navigate = useNavigate({ from: "/" });
  const [localQ, setLocalQ] = useState(search.q ?? "");

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

  return (
    <Page className="py-2">
      {/* Search */}
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-stone-400 pointer-events-none" />
        <input
          type="search"
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
          onBlur={() => applySearch(localQ)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applySearch(localQ);
          }}
          placeholder="Search recipes…"
          className="block w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 pl-10 pr-4 py-3 text-base placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:text-stone-100"
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
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors min-h-9 ${
                  active
                    ? "bg-amber-600 text-white"
                    : "bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600"
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
              ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
              : "text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-400"
          }`}
        >
          <StarIcon className="size-4" filled={search.favourite} />
          Favourites only
        </button>
      </div>

      {/* Recipe list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-6 text-center">
          <p className="text-red-700 dark:text-red-300 font-medium">Failed to load recipes</p>
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{(error as Error).message}</p>
        </div>
      ) : recipes?.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 p-10 text-center">
          <p className="text-stone-500 dark:text-stone-400 mb-4">
            {search.q || (search.tag ?? []).length > 0 || search.favourite
              ? "No recipes match your filters"
              : "No recipes yet — add your first one!"}
          </p>
          {!search.q && !(search.tag ?? []).length && !search.favourite && (
            <Link
              to="/recipes/new"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-white font-semibold hover:bg-amber-700 transition-colors"
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
                className="flex gap-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 hover:border-amber-400 dark:hover:border-amber-600 transition-colors active:bg-stone-50 dark:active:bg-stone-800"
              >
                {/* Thumbnail */}
                {recipe.imageUrl && (
                  <img
                    src={recipe.imageUrl}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    loading="lazy"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-stone-900 dark:text-stone-100 leading-snug line-clamp-2">
                      {recipe.title}
                    </h2>
                    {recipe.favourite && (
                      <StarIcon className="size-4 text-amber-500 flex-shrink-0 mt-0.5" filled />
                    )}
                  </div>

                  {totalMins > 0 && (
                    <p className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 mt-1">
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
    </Page>
  );
}
