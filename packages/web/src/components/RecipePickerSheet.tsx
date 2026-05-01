import { useEffect, useRef, useState } from "react";
import { useRecipesList } from "../api/queries";
import type { MealPlanSlot } from "../api/types";
import { SearchIcon, XIcon } from "./icons";

interface RecipePickerSheetProps {
  day: string;
  currentSlot: MealPlanSlot | null;
  onAssignRecipe: (recipeId: string) => void;
  onAssignNote: (note: string) => void;
  onClear: () => void;
  onClose: () => void;
  isSaving: boolean;
}

export function RecipePickerSheet({
  day,
  currentSlot,
  onAssignRecipe,
  onAssignNote,
  onClear,
  onClose,
  isSaving,
}: RecipePickerSheetProps) {
  const [tab, setTab] = useState<"recipes" | "text">("recipes");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState(currentSlot?.note ?? "");
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const { data: recipes = [] } = useRecipesList({ q: search || undefined });

  // Focus note input when switching to text tab
  useEffect(() => {
    if (tab === "text") {
      setTimeout(() => noteInputRef.current?.focus(), 50);
    }
  }, [tab]);

  // Prevent body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      {/* Backdrop — aria-hidden since the close button inside the sheet handles keyboard users */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is aria-hidden; keyboard users close via the button */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-(--recipe-surface) border-t border-(--recipe-border) flex flex-col max-h-[85dvh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-(--recipe-border)" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-(--recipe-border)">
          <div>
            <p className="text-xs text-(--recipe-muted)">Adding dinner for</p>
            <h2 className="font-semibold text-(--recipe-text)">{day}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-(--recipe-surface-raised) transition-colors min-h-11 min-w-11 flex items-center justify-center"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-3 gap-1">
          <button
            type="button"
            onClick={() => setTab("recipes")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors min-h-10 ${
              tab === "recipes"
                ? "bg-(--recipe-chip-bg) text-(--recipe-chip-text)"
                : "text-(--recipe-muted) hover:text-(--recipe-text)"
            }`}
          >
            Recipes
          </button>
          <button
            type="button"
            onClick={() => setTab("text")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors min-h-10 ${
              tab === "text"
                ? "bg-(--recipe-chip-bg) text-(--recipe-chip-text)"
                : "text-(--recipe-muted) hover:text-(--recipe-text)"
            }`}
          >
            Free text
          </button>
        </div>

        {tab === "recipes" ? (
          <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 pb-4 gap-3">
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-(--recipe-muted) pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipes…"
                className="block w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) pl-9 pr-4 py-2.5 text-sm text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30"
              />
            </div>

            {/* Recipe list */}
            <div className="overflow-y-auto flex-1 -mx-4 px-4 space-y-1">
              {recipes.length === 0 ? (
                <p className="text-center text-(--recipe-muted) text-sm py-8">No recipes found</p>
              ) : (
                recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onAssignRecipe(recipe.id)}
                    disabled={isSaving}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-14 text-left hover:bg-(--recipe-surface-raised) active:bg-(--recipe-surface-raised) transition-colors disabled:opacity-50 ${
                      currentSlot?.recipe_id === recipe.id
                        ? "bg-(--recipe-chip-bg) ring-1 ring-(--recipe-primary)"
                        : ""
                    }`}
                  >
                    {recipe.imageUrl && (
                      <img
                        src={recipe.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                        loading="lazy"
                      />
                    )}
                    <span className="font-medium text-(--recipe-text) line-clamp-2 flex-1">
                      {recipe.title}
                    </span>
                    {currentSlot?.recipe_id === recipe.id && (
                      <span className="text-xs text-(--recipe-primary) shrink-0">Selected</span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Clear action */}
            {(currentSlot?.recipe_id || currentSlot?.note) && (
              <button
                type="button"
                onClick={onClear}
                disabled={isSaving}
                className="w-full py-3 text-sm text-(--recipe-destructive) border border-(--recipe-destructive) rounded-xl min-h-11 hover:bg-[#2f1f1b] transition-colors disabled:opacity-50"
              >
                Clear slot
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1 px-4 pt-3 pb-4 gap-3">
            <textarea
              ref={noteInputRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="e.g. Leftovers, Takeaway, BBQ…"
              className="w-full rounded-xl border border-(--recipe-border) bg-(--recipe-surface-raised) px-4 py-3 text-sm text-(--recipe-text) placeholder-(--recipe-muted) focus:border-(--recipe-primary) focus:outline-none focus:ring-2 focus:ring-[#d7c58f]/30 resize-none"
            />
            <p className="text-xs text-(--recipe-muted) text-right">{note.length}/200</p>

            <button
              type="button"
              onClick={() => {
                if (note.trim()) onAssignNote(note.trim());
              }}
              disabled={isSaving || !note.trim()}
              className="w-full py-3 text-sm font-semibold bg-(--recipe-primary) text-(--recipe-primary-text) rounded-xl min-h-11 hover:bg-[#b8c59f] transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>

            {(currentSlot?.recipe_id || currentSlot?.note) && (
              <button
                type="button"
                onClick={onClear}
                disabled={isSaving}
                className="w-full py-3 text-sm text-(--recipe-destructive) border border-(--recipe-destructive) rounded-xl min-h-11 hover:bg-[#2f1f1b] transition-colors disabled:opacity-50"
              >
                Clear slot
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
