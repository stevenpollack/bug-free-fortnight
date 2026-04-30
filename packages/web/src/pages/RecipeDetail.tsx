import { getRouteApi, useNavigate } from "@tanstack/react-router";

const Route = getRouteApi("/recipes/$id");
import { useCallback, useEffect, useRef, useState } from "react";
import type { Ingredient } from "../api/client";
import { useDeleteRecipe, useRecipe, useTags, useToggleFavourite } from "../api/queries";
import { Page } from "../components/Page";
import { RecipeDetailSkeleton } from "../components/Skeleton";
import { TagPill } from "../components/TagPill";
import {
  ClockIcon,
  ExternalLinkIcon,
  MoonIcon,
  PencilIcon,
  StarIcon,
  SunIcon,
  TrashIcon,
} from "../components/icons";
import { logger } from "../lib/logger";
import { formatQuantity, scaleQuantity } from "../lib/quantity";

const log = logger.child("wake-lock");

// ---------------------------------------------------------------------------
// Wake Lock hook
// ---------------------------------------------------------------------------

function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const [active, setActive] = useState(false);
  const supported = "wakeLock" in navigator;

  // Log once on mount if Wake Lock API is unsupported
  useEffect(() => {
    if (!supported) {
      log.debug({ supported: false });
    }
  }, [supported]);

  const acquire = useCallback(async () => {
    if (!supported) return;
    try {
      lockRef.current = await navigator.wakeLock.request("screen");
      log.info("wake lock acquired");
      setActive(true);
      lockRef.current.addEventListener("release", () => setActive(false));
    } catch (err) {
      log.warn(err, "wake lock acquisition failed");
    }
  }, [supported]);

  const release = useCallback(() => {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
    setActive(false);
    log.info("wake lock released");
  }, []);

  // Release on visibility change (tab hidden, screen off)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        release();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [release]);

  // Release on unmount (route change)
  useEffect(() => () => release(), [release]);

  return { active, supported, acquire, release };
}

// ---------------------------------------------------------------------------
// Ingredient grouping helper
// ---------------------------------------------------------------------------

interface IngredientGroup {
  heading: string | null;
  items: Ingredient[];
}

function groupIngredients(ingredients: Ingredient[]): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  let current: IngredientGroup | null = null;
  for (const ing of ingredients) {
    const heading = ing.groupHeading ?? null;
    if (!current || current.heading !== heading) {
      current = { heading, items: [] };
      groups.push(current);
    }
    current.items.push(ing);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// RecipeDetail component
// ---------------------------------------------------------------------------

export function RecipeDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading, error } = useRecipe(id);
  const { data: allTags = [] } = useTags();
  const toggleFav = useToggleFavourite();
  const deleteRecipe = useDeleteRecipe();
  const wakeLock = useWakeLock();

  const [servings, setServings] = useState<number | null>(null);
  const [cookingMode, setCookingMode] = useState(false);

  // Sync servings state when recipe loads
  const baseServings = recipe?.baseServings ?? 1;
  const effectiveServings = servings ?? baseServings;
  const scale = effectiveServings / baseServings;

  const handleToggleCookingMode = async () => {
    if (cookingMode) {
      wakeLock.release();
      setCookingMode(false);
    } else {
      log.debug("attempting wake lock acquisition");
      await wakeLock.acquire();
      setCookingMode(true);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${recipe?.title}"? This cannot be undone.`)) return;
    await deleteRecipe.mutateAsync(id);
    navigate({ to: "/" });
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
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">
            {(error as Error | null)?.message ?? "Unknown error"}
          </p>
        </div>
      </Page>
    );
  }

  const tagMap = new Map(allTags.map((t) => [t.id, t]));
  const recipeTags = recipe.tagIds.map((id) => tagMap.get(id)).filter(Boolean);
  const groups = groupIngredients(recipe.ingredients ?? []);
  const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);

  const cookingModeClass = cookingMode ? "text-lg leading-loose" : "text-base leading-relaxed";

  return (
    <Page className="py-4 space-y-6">
      {/* Cooking mode indicator */}
      {cookingMode && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <MoonIcon className="size-4 flex-shrink-0" />
          <span>
            Screen will stay awake
            {!wakeLock.supported && " (Wake Lock not supported in this browser)"}
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1
            className={`font-bold text-stone-900 dark:text-stone-100 ${cookingMode ? "text-2xl" : "text-xl"}`}
          >
            {recipe.title}
          </h1>
          <button
            type="button"
            onClick={() => toggleFav.mutate(id)}
            aria-label={recipe.favourite ? "Remove from favourites" : "Add to favourites"}
            className="flex-shrink-0 p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors min-h-11 min-w-11 flex items-center justify-center"
          >
            <StarIcon
              className={`size-6 ${recipe.favourite ? "text-amber-500" : "text-stone-400"}`}
              filled={recipe.favourite}
            />
          </button>
        </div>

        {/* Source link */}
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400 hover:underline mb-2"
          >
            <ExternalLinkIcon className="size-4" />
            View original
          </a>
        )}

        {/* Time */}
        {totalMins > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 mb-2">
            <ClockIcon className="size-4" />
            {recipe.prepTimeMinutes != null && <span>Prep {recipe.prepTimeMinutes} min</span>}
            {recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && <span>·</span>}
            {recipe.cookTimeMinutes != null && <span>Cook {recipe.cookTimeMinutes} min</span>}
            {totalMins > 0 && (
              <>
                <span>·</span>
                <span>{totalMins} min total</span>
              </>
            )}
          </p>
        )}

        {/* Tags */}
        {recipeTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipeTags.map((tag) => tag && <TagPill key={tag.id} tag={tag} />)}
          </div>
        )}
      </div>

      {/* Image */}
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="w-full rounded-xl object-cover max-h-64"
          loading="lazy"
        />
      )}

      {/* Description */}
      {recipe.description && (
        <p className={`text-stone-700 dark:text-stone-300 ${cookingModeClass}`}>
          {recipe.description}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/recipes/$id/edit", params: { id } })}
          className="flex items-center gap-2 rounded-lg border border-stone-300 dark:border-stone-600 px-4 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors min-h-11"
        >
          <PencilIcon className="size-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteRecipe.isPending}
          className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors min-h-11 disabled:opacity-50"
        >
          <TrashIcon className="size-4" />
          {deleteRecipe.isPending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={handleToggleCookingMode}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors min-h-11 ${
            cookingMode
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
          }`}
        >
          {cookingMode ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          {cookingMode ? "Exit cooking mode" : "Cooking mode"}
        </button>
      </div>

      {/* Servings scaler */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-4">
        <div className="flex items-center justify-between">
          <span
            className={`font-medium text-stone-700 dark:text-stone-300 ${cookingMode ? "text-lg" : "text-base"}`}
          >
            Servings
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setServings(Math.max(1, effectiveServings - 1))}
              aria-label="Decrease servings"
              className="w-11 h-11 rounded-full border border-stone-300 dark:border-stone-600 flex items-center justify-center text-xl font-medium hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-30"
              disabled={effectiveServings <= 1}
            >
              −
            </button>
            <span
              className={`w-8 text-center font-semibold ${cookingMode ? "text-xl" : "text-lg"}`}
            >
              {effectiveServings}
            </span>
            <button
              type="button"
              onClick={() => setServings(effectiveServings + 1)}
              aria-label="Increase servings"
              className="w-11 h-11 rounded-full border border-stone-300 dark:border-stone-600 flex items-center justify-center text-xl font-medium hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              +
            </button>
          </div>
        </div>
        {scale !== 1 && (
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 text-right">
            Base: {baseServings} · Scale: ×{Number.parseFloat(scale.toFixed(2))}
          </p>
        )}
      </div>

      {/* Ingredients */}
      {groups.length > 0 && (
        <div>
          <h2
            className={`font-bold text-stone-900 dark:text-stone-100 mb-3 ${cookingMode ? "text-xl" : "text-lg"}`}
          >
            Ingredients
          </h2>
          <div className="space-y-4">
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.heading && (
                  <h3
                    className={`font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wide mb-2 ${cookingMode ? "text-base" : "text-sm"}`}
                  >
                    {group.heading}
                  </h3>
                )}
                <ul className="space-y-2">
                  {group.items.map((ing) => {
                    const scaled = scaleQuantity(ing.quantity, baseServings, effectiveServings);
                    const scaledStr = formatQuantity(scaled);
                    const baseStr = formatQuantity(ing.quantity);
                    return (
                      <li
                        key={ing.id}
                        className={`flex gap-2 text-stone-800 dark:text-stone-200 ${cookingModeClass}`}
                      >
                        <span className="flex-shrink-0 min-w-14 text-right font-medium">
                          {scaledStr}
                          {scale !== 1 && baseStr && (
                            <span className="text-stone-400 dark:text-stone-500 font-normal text-sm block">
                              ({baseStr})
                            </span>
                          )}
                        </span>
                        <span className="flex-shrink-0 text-stone-500 dark:text-stone-400 min-w-10">
                          {ing.unit}
                        </span>
                        <span>
                          {ing.item}
                          {ing.notes && (
                            <span className="text-stone-400 dark:text-stone-500 italic ml-1">
                              , {ing.notes}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      {recipe.instructions.length > 0 && (
        <div>
          <h2
            className={`font-bold text-stone-900 dark:text-stone-100 mb-3 ${cookingMode ? "text-xl" : "text-lg"}`}
          >
            Instructions
          </h2>
          <ol className="space-y-4">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={`flex-shrink-0 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold ${cookingMode ? "size-9 text-base" : "size-7 text-sm"}`}
                >
                  {i + 1}
                </span>
                <p className={`text-stone-800 dark:text-stone-200 pt-0.5 ${cookingModeClass}`}>
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Notes */}
      {recipe.notes && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900 p-4">
          <h2
            className={`font-bold text-amber-900 dark:text-amber-200 mb-2 ${cookingMode ? "text-lg" : "text-base"}`}
          >
            Notes
          </h2>
          <p
            className={`text-amber-800 dark:text-amber-300 whitespace-pre-line ${cookingModeClass}`}
          >
            {recipe.notes}
          </p>
        </div>
      )}
    </Page>
  );
}
