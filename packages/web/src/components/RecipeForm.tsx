import type { RecipeCreate } from "@api/schemas";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";
import type { RecipeDetail, Tag } from "../api/client";
import { useTags, useUpsertTag } from "../api/queries";
import { TagPill } from "./TagPill";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon, XIcon } from "./icons";

// ---------------------------------------------------------------------------
// Form value types
// ---------------------------------------------------------------------------

export interface FormIngredient {
  quantity: string;
  unit: string;
  item: string;
  notes: string;
  groupHeading: string;
  originalLine: string;
}

export interface RecipeFormValues {
  title: string;
  description: string;
  sourceUrl: string;
  imageUrl: string;
  baseServings: number;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  notes: string;
  instructions: string[];
  favourite: boolean;
  ingredients: FormIngredient[];
  tagIds: string[];
}

export function defaultFormValues(): RecipeFormValues {
  return {
    title: "",
    description: "",
    sourceUrl: "",
    imageUrl: "",
    baseServings: 1,
    prepTimeMinutes: "",
    cookTimeMinutes: "",
    notes: "",
    instructions: [""],
    favourite: false,
    ingredients: [],
    tagIds: [],
  };
}

/** Convert a RecipeDetail (from API read) to form values. */
export function detailToFormValues(recipe: RecipeDetail): RecipeFormValues {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    sourceUrl: recipe.sourceUrl ?? "",
    imageUrl: recipe.imageUrl ?? "",
    baseServings: recipe.baseServings,
    prepTimeMinutes: recipe.prepTimeMinutes != null ? String(recipe.prepTimeMinutes) : "",
    cookTimeMinutes: recipe.cookTimeMinutes != null ? String(recipe.cookTimeMinutes) : "",
    notes: recipe.notes ?? "",
    instructions: recipe.instructions.length > 0 ? recipe.instructions : [""],
    favourite: recipe.favourite,
    ingredients: recipe.ingredients.map((ing) => ({
      quantity: ing.quantity != null ? String(ing.quantity) : "",
      unit: ing.unit ?? "",
      item: ing.item,
      notes: ing.notes ?? "",
      groupHeading: ing.groupHeading ?? "",
      originalLine: ing.originalLine,
    })),
    tagIds: recipe.tagIds,
  };
}

/** Convert a RecipeCreate payload (e.g. from import preview) to form values. */
export function recipeCreateToFormValues(data: RecipeCreate): RecipeFormValues {
  return {
    title: data.title,
    description: data.description ?? "",
    sourceUrl: data.sourceUrl ?? "",
    imageUrl: data.imageUrl ?? "",
    baseServings: data.baseServings,
    prepTimeMinutes: data.prepTimeMinutes != null ? String(data.prepTimeMinutes) : "",
    cookTimeMinutes: data.cookTimeMinutes != null ? String(data.cookTimeMinutes) : "",
    notes: data.notes ?? "",
    instructions: data.instructions.length > 0 ? data.instructions : [""],
    favourite: data.favourite,
    ingredients: (data.ingredients ?? []).map((ing) => ({
      quantity: ing.quantity != null ? String(ing.quantity) : "",
      unit: ing.unit ?? "",
      item: ing.item,
      notes: ing.notes ?? "",
      groupHeading: ing.groupHeading ?? "",
      originalLine: ing.originalLine ?? ing.item,
    })),
    tagIds: data.tagIds ?? [],
  };
}

/** Build a RecipeCreate payload from form values. */
export function formValuesToRecipeCreate(v: RecipeFormValues): RecipeCreate {
  const parseMinutes = (s: string): number | null => {
    const n = Number.parseInt(s, 10);
    return s.trim() && !Number.isNaN(n) && n >= 0 ? n : null;
  };
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    sourceUrl: v.sourceUrl.trim() || null,
    imageUrl: v.imageUrl.trim() || null,
    baseServings: v.baseServings,
    prepTimeMinutes: parseMinutes(v.prepTimeMinutes),
    cookTimeMinutes: parseMinutes(v.cookTimeMinutes),
    notes: v.notes.trim() || null,
    instructions: v.instructions.map((s) => s.trim()).filter(Boolean),
    favourite: v.favourite,
    ingredients: v.ingredients
      .filter((ing) => ing.item.trim())
      .map((ing, idx) => {
        const qRaw = Number.parseFloat(ing.quantity.trim());
        return {
          displayOrder: idx,
          groupHeading: ing.groupHeading.trim() || null,
          quantity: ing.quantity.trim() && !Number.isNaN(qRaw) ? qRaw : null,
          unit: ing.unit.trim() || null,
          item: ing.item.trim(),
          notes: ing.notes.trim() || null,
          originalLine: ing.originalLine || ing.item.trim(),
        };
      }),
    tagIds: v.tagIds,
  };
}

// ---------------------------------------------------------------------------
// Shared input styles
// ---------------------------------------------------------------------------

const inputCls =
  "block w-full rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 " +
  "px-3 py-2.5 text-base leading-tight placeholder-stone-400 " +
  "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:text-stone-100";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
    >
      {children}
    </label>
  );
}

function FieldError({ errors }: { errors: unknown[] }) {
  const msgs = errors
    .filter(Boolean)
    .map((e) => {
      if (typeof e === "string") return e;
      if (e !== null && typeof e === "object" && "message" in e) {
        return String((e as { message: unknown }).message);
      }
      return String(e);
    })
    .filter(Boolean);
  if (msgs.length === 0) return null;
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{msgs.join(", ")}</p>;
}

// ---------------------------------------------------------------------------
// Tag picker
// ---------------------------------------------------------------------------

function TagPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: allTags = [] } = useTags();
  const upsertTag = useUpsertTag();
  const [newTagName, setNewTagName] = useState("");
  const [showNew, setShowNew] = useState(false);

  const selectedTags = allTags.filter((t) => selectedIds.includes(t.id));
  const unselectedTags = allTags.filter((t) => !selectedIds.includes(t.id));

  const toggle = (tag: Tag) => {
    if (selectedIds.includes(tag.id)) {
      onChange(selectedIds.filter((id) => id !== tag.id));
    } else {
      onChange([...selectedIds, tag.id]);
    }
  };

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const result = await upsertTag.mutateAsync({ name });
    onChange([...selectedIds, result.tag.id]);
    setNewTagName("");
    setShowNew(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-8">
        {selectedTags.map((tag) => (
          <TagPill key={tag.id} tag={tag} onRemove={() => toggle(tag)} />
        ))}
        {selectedTags.length === 0 && (
          <span className="text-sm text-stone-400">No tags selected</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {unselectedTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag)}
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600 border border-stone-200 dark:border-stone-600 transition-colors min-h-7"
          >
            + {tag.name}
          </button>
        ))}
      </div>

      {showNew ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="Tag name"
            className={`${inputCls} flex-1 text-sm py-2`}
            // biome-ignore lint/a11y/noAutofocus: intentional for inline form
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={upsertTag.isPending}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 min-h-11"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNew(false);
              setNewTagName("");
            }}
            className="rounded-lg border border-stone-300 dark:border-stone-600 px-3 py-2 text-sm min-h-11"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="text-sm text-amber-700 dark:text-amber-400 underline-offset-2 hover:underline"
        >
          + Create new tag
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingredient row — plain state management through parent field
// ---------------------------------------------------------------------------

function IngredientRow({
  ing,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  ing: FormIngredient;
  index: number;
  total: number;
  onChange: (updated: FormIngredient) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const upd = (key: keyof FormIngredient, value: string) => onChange({ ...ing, [key]: value });

  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-700 p-3 space-y-2">
      <input
        type="text"
        value={ing.groupHeading}
        onChange={(e) => upd("groupHeading", e.target.value)}
        placeholder="Group heading (optional)"
        className={`${inputCls} text-sm`}
      />

      <div className="grid grid-cols-[5rem_7rem_1fr] gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={ing.quantity}
          onChange={(e) => upd("quantity", e.target.value)}
          placeholder="Qty"
          className={`${inputCls} text-sm`}
        />
        <input
          type="text"
          value={ing.unit}
          onChange={(e) => upd("unit", e.target.value)}
          placeholder="Unit"
          className={`${inputCls} text-sm`}
        />
        <input
          type="text"
          value={ing.item}
          onChange={(e) => upd("item", e.target.value)}
          placeholder="Ingredient *"
          className={`${inputCls} text-sm`}
        />
      </div>

      <input
        type="text"
        value={ing.notes}
        onChange={(e) => upd("notes", e.target.value)}
        placeholder="Notes (optional)"
        className={`${inputCls} text-sm`}
      />

      <div className="flex justify-between items-center pt-1">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label="Move ingredient up"
            className="p-1.5 rounded border border-stone-300 dark:border-stone-600 disabled:opacity-30 min-h-9 min-w-9 flex items-center justify-center"
          >
            <ChevronUpIcon className="size-4" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            aria-label="Move ingredient down"
            className="p-1.5 rounded border border-stone-300 dark:border-stone-600 disabled:opacity-30 min-h-9 min-w-9 flex items-center justify-center"
          >
            <ChevronDownIcon className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove ingredient"
          className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950 min-h-9 min-w-9 flex items-center justify-center"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main RecipeForm component
// ---------------------------------------------------------------------------

interface RecipeFormProps {
  defaultValues?: RecipeFormValues;
  onSubmit: (data: RecipeCreate) => Promise<void>;
  submitLabel?: string;
  serverError?: string;
}

export function RecipeForm({
  defaultValues = defaultFormValues(),
  onSubmit,
  submitLabel = "Save Recipe",
  serverError,
}: RecipeFormProps) {
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await onSubmit(formValuesToRecipeCreate(value));
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-6"
      noValidate
    >
      {/* Title */}
      <div>
        <form.Field
          name="title"
          validators={{
            onChange: ({ value }: { value: string }) =>
              z.string().min(1, "Title is required").safeParse(value).error?.issues[0]?.message,
          }}
        >
          {(field) => (
            <div>
              <Label htmlFor="title">Title *</Label>
              <input
                id="title"
                type="text"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g. French Toast"
                className={inputCls}
              />
              {field.state.meta.isTouched && (
                <FieldError errors={field.state.meta.errors as unknown[]} />
              )}
            </div>
          )}
        </form.Field>
      </div>

      {/* Description */}
      <div>
        <form.Field name="description">
          {(field) => (
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                rows={2}
                placeholder="A short description"
                className={`${inputCls} resize-none`}
              />
            </div>
          )}
        </form.Field>
      </div>

      {/* Servings + times */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <form.Field name="baseServings">
            {(field) => (
              <div>
                <Label htmlFor="baseServings">Servings *</Label>
                <input
                  id="baseServings"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                  }
                  onBlur={field.handleBlur}
                  className={inputCls}
                />
              </div>
            )}
          </form.Field>
        </div>
        <div>
          <form.Field name="prepTimeMinutes">
            {(field) => (
              <div>
                <Label htmlFor="prepTimeMinutes">Prep (min)</Label>
                <input
                  id="prepTimeMinutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="—"
                  className={inputCls}
                />
              </div>
            )}
          </form.Field>
        </div>
        <div>
          <form.Field name="cookTimeMinutes">
            {(field) => (
              <div>
                <Label htmlFor="cookTimeMinutes">Cook (min)</Label>
                <input
                  id="cookTimeMinutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="—"
                  className={inputCls}
                />
              </div>
            )}
          </form.Field>
        </div>
      </div>

      {/* URLs */}
      <div className="space-y-4">
        <form.Field name="sourceUrl">
          {(field) => (
            <div>
              <Label htmlFor="sourceUrl">Source URL</Label>
              <input
                id="sourceUrl"
                type="url"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="imageUrl">
          {(field) => (
            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <input
                id="imageUrl"
                type="url"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          )}
        </form.Field>
      </div>

      {/* Tags */}
      <div>
        <Label>Tags</Label>
        <form.Field name="tagIds">
          {(field) => (
            <TagPicker
              selectedIds={field.state.value}
              onChange={(ids) => field.handleChange(ids)}
            />
          )}
        </form.Field>
      </div>

      {/* Ingredients */}
      <div>
        <h3 className="text-base font-semibold text-stone-800 dark:text-stone-200 mb-3">
          Ingredients
        </h3>
        <form.Field name="ingredients">
          {(field) => (
            <div className="space-y-3">
              {field.state.value.map((ing, i) => (
                <IngredientRow
                  key={i}
                  ing={ing}
                  index={i}
                  total={field.state.value.length}
                  onChange={(updated) => {
                    const next = [...field.state.value];
                    next[i] = updated;
                    field.handleChange(next);
                  }}
                  onMoveUp={() => {
                    const next = [...field.state.value];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    field.handleChange(next);
                  }}
                  onMoveDown={() => {
                    const next = [...field.state.value];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    field.handleChange(next);
                  }}
                  onRemove={() => field.handleChange(field.state.value.filter((_, j) => j !== i))}
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  field.handleChange([
                    ...field.state.value,
                    {
                      quantity: "",
                      unit: "",
                      item: "",
                      notes: "",
                      groupHeading: "",
                      originalLine: "",
                    },
                  ])
                }
                className="flex items-center gap-2 w-full justify-center rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 py-3 text-sm text-stone-500 dark:text-stone-400 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors min-h-11"
              >
                <PlusIcon className="size-4" />
                Add Ingredient
              </button>
            </div>
          )}
        </form.Field>
      </div>

      {/* Instructions */}
      <div>
        <h3 className="text-base font-semibold text-stone-800 dark:text-stone-200 mb-3">
          Instructions
        </h3>
        <form.Field name="instructions">
          {(field) => (
            <div className="space-y-2">
              {field.state.value.map((step, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="flex-shrink-0 w-7 h-10 flex items-center justify-center text-sm font-medium text-stone-400 dark:text-stone-500">
                    {i + 1}.
                  </span>
                  <textarea
                    value={step}
                    onChange={(e) => {
                      const next = [...field.state.value];
                      next[i] = e.target.value;
                      field.handleChange(next);
                    }}
                    placeholder={`Step ${i + 1}`}
                    rows={2}
                    className={`${inputCls} resize-none flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => field.handleChange(field.state.value.filter((_, j) => j !== i))}
                    disabled={field.state.value.length === 1}
                    aria-label={`Remove step ${i + 1}`}
                    className="p-2 rounded text-stone-400 hover:text-red-500 disabled:opacity-20 min-h-11 min-w-9 flex items-center"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => field.handleChange([...field.state.value, ""])}
                className="flex items-center gap-2 w-full justify-center rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 py-3 text-sm text-stone-500 dark:text-stone-400 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-400 transition-colors min-h-11"
              >
                <PlusIcon className="size-4" />
                Add Step
              </button>
            </div>
          )}
        </form.Field>
      </div>

      {/* Notes */}
      <div>
        <form.Field name="notes">
          {(field) => (
            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                rows={3}
                placeholder="Any tips, variations, or storage notes"
                className={`${inputCls} resize-none`}
              />
            </div>
          )}
        </form.Field>
      </div>

      {/* Favourite */}
      <div>
        <form.Field name="favourite">
          {(field) => (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
                className="size-5 rounded border-stone-300 accent-amber-600"
              />
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Mark as favourite
              </span>
            </label>
          )}
        </form.Field>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{serverError}</p>
        </div>
      )}

      {/* Sticky submit */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] md:bottom-0 bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur py-3 -mx-4 px-4 border-t border-stone-200 dark:border-stone-700 md:border-none md:bg-transparent md:backdrop-blur-none md:py-0 md:mx-0 md:px-0">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-60 text-white font-semibold py-3.5 text-base transition-colors min-h-14"
            >
              {isSubmitting ? "Saving…" : submitLabel}
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
