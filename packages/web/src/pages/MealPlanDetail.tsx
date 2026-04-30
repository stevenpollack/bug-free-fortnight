import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { DayKey, MealPlanSlot } from "../api/client";
import { useActivateMealPlan, useMealPlan, useUpdateMealPlan, useUpsertSlot } from "../api/queries";
import { Page } from "../components/Page";
import { RecipePickerSheet } from "../components/RecipePickerSheet";
import { ShoppingList } from "../components/ShoppingList";
import { XIcon } from "../components/icons";

const Route = getRouteApi("/meal-plans/$id");

const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const ALL_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// ---------------------------------------------------------------------------
// Inline name editor
// ---------------------------------------------------------------------------

interface NameEditorProps {
  initialName: string | null;
  onSave: (name: string | null) => void;
  isSaving: boolean;
}

function NameEditor({ initialName, onSave, isSaving }: NameEditorProps) {
  const [value, setValue] = useState(initialName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when plan name changes from outside (e.g. after activation)
  useEffect(() => {
    setValue(initialName ?? "");
  }, [initialName]);

  const handleBlur = () => {
    const trimmed = value.trim() || null;
    if (trimmed !== initialName) {
      onSave(trimmed);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") inputRef.current?.blur();
      }}
      placeholder="Unnamed plan"
      disabled={isSaving}
      className="text-xl font-bold bg-transparent border-b border-transparent hover:border-(--recipe-border) focus:border-(--recipe-primary) focus:outline-none text-(--recipe-text) placeholder-(--recipe-muted) w-full transition-colors pb-0.5 disabled:opacity-50"
    />
  );
}

// ---------------------------------------------------------------------------
// Day card
// ---------------------------------------------------------------------------

interface DayCardProps {
  day: DayKey;
  slot: MealPlanSlot | null;
  onTap: () => void;
  onClear: () => void;
  isClearing: boolean;
}

function DayCard({ day, slot, onTap, onClear, isClearing }: DayCardProps) {
  const filled = slot && (slot.recipe_id || slot.note);

  return (
    <div className="rounded-xl border border-(--recipe-border) bg-(--recipe-surface) overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-(--recipe-border)">
        <span className="text-sm font-semibold text-(--recipe-muted)">{DAY_LABELS[day]}</span>
        {filled && (
          <button
            type="button"
            onClick={onClear}
            disabled={isClearing}
            aria-label={`Clear ${DAY_LABELS[day]}`}
            className="p-1 rounded-md text-(--recipe-muted) hover:text-(--recipe-text) hover:bg-(--recipe-surface-raised) transition-colors disabled:opacity-50"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onTap}
        className="w-full text-left px-4 py-3 min-h-14 flex items-center gap-3 hover:bg-(--recipe-surface-raised) active:bg-(--recipe-surface-raised) transition-colors"
      >
        {slot?.recipe_id ? (
          <>
            {slot.recipe_image_url && (
              <img
                src={slot.recipe_image_url}
                alt=""
                className="w-10 h-10 rounded-lg object-cover shrink-0"
                loading="lazy"
              />
            )}
            <span className="font-medium text-(--recipe-text) line-clamp-2 flex-1">
              {slot.recipe_title}
            </span>
          </>
        ) : slot?.note ? (
          <span className="text-(--recipe-muted) italic flex-1">{slot.note}</span>
        ) : (
          <span className="text-(--recipe-muted) text-sm">— Add dinner</span>
        )}
      </button>
      {/* Navigate to recipe on title tap — separate link so card tap opens picker */}
      {slot?.recipe_id && (
        <Link
          to="/recipes/$id"
          params={{ id: slot.recipe_id }}
          className="block px-4 pb-2 text-xs text-(--recipe-accent) hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View recipe
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MealPlanDetail
// ---------------------------------------------------------------------------

export function MealPlanDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: plan, isLoading, error } = useMealPlan(id);
  const updatePlan = useUpdateMealPlan(id);
  const activatePlan = useActivateMealPlan();
  const upsertSlot = useUpsertSlot(id);

  const [pickerDay, setPickerDay] = useState<DayKey | null>(null);

  if (isLoading) {
    return (
      <Page className="py-4">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-(--recipe-border) bg-(--recipe-surface) h-20 animate-pulse"
            />
          ))}
        </div>
      </Page>
    );
  }

  if (error || !plan) {
    return (
      <Page className="py-8">
        <div className="rounded-xl bg-[#2f1f1b] border border-(--recipe-destructive) p-6 text-center">
          <p className="text-(--recipe-destructive) font-medium">Meal plan not found</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/meal-plans" })}
            className="mt-3 text-sm text-(--recipe-accent) hover:underline"
          >
            Back to plans
          </button>
        </div>
      </Page>
    );
  }

  const handleSlotAssign = (
    day: DayKey,
    value: { recipe_id?: string | null; note?: string | null },
  ) => {
    upsertSlot.mutate({ day, body: value });
    setPickerDay(null);
  };

  const handleSlotClear = (day: DayKey) => {
    upsertSlot.mutate({ day, body: { recipe_id: null, note: null } });
  };

  return (
    <Page className="py-4 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/meal-plans" })}
          className="text-sm text-(--recipe-muted) hover:text-(--recipe-text) transition-colors"
        >
          ← Meal Plans
        </button>
        <NameEditor
          initialName={plan.name}
          onSave={(name) => updatePlan.mutate({ name })}
          isSaving={updatePlan.isPending}
        />

        <button
          type="button"
          onClick={() => activatePlan.mutate(id)}
          disabled={activatePlan.isPending}
          className={`text-sm font-medium rounded-lg px-3 py-1.5 min-h-9 transition-colors ${
            plan.is_active
              ? "bg-(--recipe-chip-bg) text-(--recipe-chip-text)"
              : "border border-(--recipe-primary) text-(--recipe-primary) hover:bg-(--recipe-chip-bg)"
          } disabled:opacity-50`}
        >
          {plan.is_active
            ? "This Week ✓"
            : activatePlan.isPending
              ? "Setting…"
              : "Set as this week"}
        </button>
      </div>

      {/* Day grid */}
      <div className="space-y-2">
        {ALL_DAYS.map((day) => (
          <DayCard
            key={day}
            day={day}
            slot={plan.slots[day]}
            onTap={() => setPickerDay(day)}
            onClear={() => handleSlotClear(day)}
            isClearing={
              upsertSlot.isPending &&
              upsertSlot.variables?.day === day &&
              upsertSlot.variables?.body.recipe_id === null
            }
          />
        ))}
      </div>

      {/* Shopping list */}
      <ShoppingList planId={id} />

      {/* Recipe picker sheet */}
      {pickerDay && (
        <RecipePickerSheet
          day={DAY_LABELS[pickerDay]}
          currentSlot={plan.slots[pickerDay]}
          onAssignRecipe={(recipeId) =>
            handleSlotAssign(pickerDay, { recipe_id: recipeId, note: null })
          }
          onAssignNote={(note) => handleSlotAssign(pickerDay, { note, recipe_id: null })}
          onClear={() => handleSlotAssign(pickerDay, { recipe_id: null, note: null })}
          onClose={() => setPickerDay(null)}
          isSaving={upsertSlot.isPending}
        />
      )}
    </Page>
  );
}
