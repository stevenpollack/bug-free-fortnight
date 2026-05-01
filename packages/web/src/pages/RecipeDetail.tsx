import { getRouteApi, useNavigate } from "@tanstack/react-router";

const Route = getRouteApi("/recipes/$id");
import { useCallback, useEffect, useRef, useState } from "react";
import { useDeleteRecipe, useRecipe, useTags, useToggleFavourite } from "../api/queries";
import type { Ingredient } from "../api/types";
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
        <div className="rounded-xl bg-[#2f1f1b] border border-(--recipe-destructive) p-6 text-center">
          <p className="text-(--recipe-destructive) font-medium">Recipe not found</p>
          <p className="text-sm text-[#e6a092] mt-1">
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
        <div className="rounded-lg bg-(--recipe-chip-bg) border border-(--recipe-primary) px-4 py-2 flex items-center gap-2 text-sm text-(--recipe-chip-text)">
          <MoonIcon className="size-4 shrink-0" />
          <span>
            Screen will stay awake
            {!wakeLock.supported && " (Wake Lock not supported in this browser)"}
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className={`font-bold text-(--recipe-text) ${cookingMode ? "text-2xl" : "text-xl"}`}>
            {recipe.title}
          </h1>
          <button
            type="button"
            onClick={() => toggleFav.mutate(id)}
            aria-label={recipe.favourite ? "Remove from favourites" : "Add to favourites"}
            className="shrink-0 p-2 rounded-full hover:bg-(--recipe-surface-raised) transition-colors min-h-11 min-w-11 flex items-center justify-center"
          >
            <StarIcon
              className={`size-6 ${recipe.favourite ? "text-(--recipe-accent)" : "text-(--recipe-muted)"}`}
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
            className="inline-flex items-center gap-1.5 text-sm text-(--recipe-accent) hover:underline mb-2"
          >
            <ExternalLinkIcon className="size-4" />
            View original
          </a>
        )}

        {/* Time */}
        {totalMins > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-(--recipe-muted) mb-2">
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
        <p className={`text-(--recipe-text) ${cookingModeClass}`}>{recipe.description}</p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/recipes/$id/edit", params: { id } })}
          className="flex items-center gap-2 rounded-lg border border-(--recipe-border) px-4 py-2.5 text-sm font-medium text-(--recipe-text) hover:bg-(--recipe-surface-raised) transition-colors min-h-11"
        >
          <PencilIcon className="size-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteRecipe.isPending}
          className="flex items-center gap-2 rounded-lg border border-(--recipe-destructive) px-4 py-2.5 text-sm font-medium text-(--recipe-destructive) hover:bg-[#2f1f1b] transition-colors min-h-11 disabled:opacity-50"
        >
          <TrashIcon className="size-4" />
          {deleteRecipe.isPending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={handleToggleCookingMode}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors min-h-11 ${
            cookingMode
              ? "bg-(--recipe-primary) text-(--recipe-primary-text) hover:bg-[#b8c59f]"
              : "border border-(--recipe-border) text-(--recipe-text) hover:bg-(--recipe-surface-raised)"
          }`}
        >
          {cookingMode ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          {cookingMode ? "Exit cooking mode" : "Cooking mode"}
        </button>
      </div>

      {/* Servings scaler */}
      <div className="rounded-xl border border-(--recipe-border) bg-(--recipe-surface) p-4">
        <div className="flex items-center justify-between">
          <span
            className={`font-medium text-(--recipe-text) ${cookingMode ? "text-lg" : "text-base"}`}
          >
            Servings
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setServings(Math.max(1, effectiveServings - 1))}
              aria-label="Decrease servings"
              className="w-11 h-11 rounded-full border border-(--recipe-border) flex items-center justify-center text-xl font-medium hover:bg-(--recipe-surface-raised) transition-colors disabled:opacity-30"
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
              className="w-11 h-11 rounded-full border border-(--recipe-border) flex items-center justify-center text-xl font-medium hover:bg-(--recipe-surface-raised) transition-colors"
            >
              +
            </button>
          </div>
        </div>
        {scale !== 1 && (
          <p className="text-xs text-(--recipe-muted) mt-1 text-right">
            Base: {baseServings} · Scale: ×{Number.parseFloat(scale.toFixed(2))}
          </p>
        )}
      </div>

      {/* Ingredients */}
      {groups.length > 0 && (
        <div>
          <h2
            className={`font-bold text-(--recipe-text) mb-3 ${cookingMode ? "text-xl" : "text-lg"}`}
          >
            Ingredients
          </h2>
          <div className="space-y-4">
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.heading && (
                  <h3
                    className={`font-semibold text-(--recipe-muted) uppercase tracking-wide mb-2 ${cookingMode ? "text-base" : "text-sm"}`}
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
                        className={`flex gap-2 text-(--recipe-text) ${cookingModeClass}`}
                      >
                        <span className="shrink-0 min-w-14 text-right font-medium">
                          {scaledStr}
                          {scale !== 1 && baseStr && (
                            <span className="text-(--recipe-muted) font-normal text-sm block">
                              ({baseStr})
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-(--recipe-muted) min-w-10">{ing.unit}</span>
                        <span>
                          {ing.item}
                          {ing.notes && (
                            <span className="text-(--recipe-muted) italic ml-1">, {ing.notes}</span>
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
            className={`font-bold text-(--recipe-text) mb-3 ${cookingMode ? "text-xl" : "text-lg"}`}
          >
            Instructions
          </h2>
          <ol className="space-y-4">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={`shrink-0 flex items-center justify-center rounded-full bg-(--recipe-chip-bg) text-(--recipe-chip-text) font-bold ${cookingMode ? "size-9 text-base" : "size-7 text-sm"}`}
                >
                  {i + 1}
                </span>
                <p className={`text-(--recipe-text) pt-0.5 ${cookingModeClass}`}>{step}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Notes */}
      {recipe.notes && (
        <div className="rounded-xl bg-(--recipe-surface) border border-(--recipe-border) p-4">
          <h2
            className={`font-bold text-(--recipe-primary) mb-2 ${cookingMode ? "text-lg" : "text-base"}`}
          >
            Notes
          </h2>
          <p className={`text-(--recipe-text) whitespace-pre-line ${cookingModeClass}`}>
            {recipe.notes}
          </p>
        </div>
      )}
    </Page>
  );
}
