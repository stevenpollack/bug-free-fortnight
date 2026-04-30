import { useState } from "react";
import type { ShoppingListItem } from "../api/client";
import {
  useAddShoppingListItem,
  useDeleteShoppingListItem,
  useGenerateShoppingList,
  useShoppingList,
  useToggleShoppingListItem,
} from "../api/queries";
import { formatQuantity } from "../lib/quantity";
import { AlertIcon, PlusIcon, TrashIcon } from "./icons";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShoppingListProps {
  planId: string;
}

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

interface ItemRowProps {
  item: ShoppingListItem;
  planId: string;
}

function ItemRow({ item, planId }: ItemRowProps) {
  const toggle = useToggleShoppingListItem(planId);
  const deleteItem = useDeleteShoppingListItem(planId);

  const quantityStr = formatQuantity(item.quantity);
  const label = [quantityStr, item.unit, item.item].filter(Boolean).join(" ");

  return (
    <li className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-(--recipe-surface-raised) transition-colors group min-h-11">
      <button
        type="button"
        onClick={() => toggle.mutate({ itemId: item.id, checked: !item.checked })}
        disabled={toggle.isPending}
        aria-label={item.checked ? `Uncheck ${item.item}` : `Check ${item.item}`}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
          item.checked
            ? "bg-(--recipe-primary) border-(--recipe-primary)"
            : "border-(--recipe-border) hover:border-(--recipe-primary)"
        }`}
      >
        {item.checked && (
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-white">
            <polyline
              points="2 6 5 9 10 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <span
        className={`flex-1 text-sm text-(--recipe-text) transition-opacity ${
          item.checked ? "opacity-60 line-through decoration-(--recipe-muted)" : ""
        }`}
      >
        {label}
        {item.notes && (
          <span className="ml-1 text-xs text-(--recipe-muted) not-italic">({item.notes})</span>
        )}
        {item.custom && (
          <span className="ml-1 text-xs text-(--recipe-accent) opacity-70">custom</span>
        )}
      </span>

      <button
        type="button"
        onClick={() => deleteItem.mutate(item.id)}
        disabled={deleteItem.isPending}
        aria-label={`Remove ${item.item}`}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-(--recipe-muted) hover:text-(--recipe-destructive) transition-opacity disabled:opacity-50"
      >
        <TrashIcon className="size-4" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Add custom item form
// ---------------------------------------------------------------------------

interface AddItemFormProps {
  planId: string;
  onDone: () => void;
}

function AddItemForm({ planId, onDone }: AddItemFormProps) {
  const [value, setValue] = useState("");
  const addItem = useAddShoppingListItem(planId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    addItem.mutate(
      { item: trimmed },
      {
        onSuccess: () => {
          setValue("");
          onDone();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add item…"
        className="flex-1 min-h-11 px-3 py-2 rounded-lg border border-(--recipe-border) bg-(--recipe-surface) text-sm text-(--recipe-text) placeholder-(--recipe-muted) focus:outline-none focus:border-(--recipe-primary) transition-colors"
      />
      <button
        type="submit"
        disabled={!value.trim() || addItem.isPending}
        className="min-h-11 px-4 rounded-lg bg-(--recipe-primary) text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {addItem.isPending ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="min-h-11 px-3 rounded-lg border border-(--recipe-border) text-sm text-(--recipe-muted) hover:text-(--recipe-text) transition-colors"
      >
        Cancel
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ShoppingList
// ---------------------------------------------------------------------------

export function ShoppingList({ planId }: ShoppingListProps) {
  const { data, isLoading, error } = useShoppingList(planId);
  const generate = useGenerateShoppingList(planId);
  const [showAddForm, setShowAddForm] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-11 rounded-lg bg-(--recipe-surface) border border-(--recipe-border) animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-(--recipe-destructive) bg-[#2f1f1b] p-4 text-sm text-(--recipe-destructive)">
        Failed to load shopping list.
      </div>
    );
  }

  const list = data?.shoppingList ?? null;
  const planUpdatedAt = data?.plan_updated_at;
  const isStale =
    list != null &&
    planUpdatedAt != null &&
    new Date(planUpdatedAt).getTime() > new Date(list.plan_snapshot_at).getTime();

  const unchecked = list?.items.filter((i) => !i.checked) ?? [];
  const checked = list?.items.filter((i) => i.checked) ?? [];

  return (
    <section className="mt-6 space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-(--recipe-text)">Shopping List</h2>

        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="text-sm font-medium px-3 py-1.5 min-h-9 rounded-lg border border-(--recipe-primary) text-(--recipe-primary) hover:bg-(--recipe-chip-bg) transition-colors disabled:opacity-50"
        >
          {generate.isPending ? "Generating…" : list ? "Regenerate" : "Generate"}
        </button>
      </div>

      {/* Staleness banner */}
      {isStale && (
        <div className="flex items-start gap-2 rounded-xl border border-(--recipe-accent) bg-(--recipe-chip-bg) px-4 py-3 text-sm text-(--recipe-text)">
          <AlertIcon className="size-4 shrink-0 mt-0.5 text-(--recipe-accent)" />
          <span>
            The meal plan has changed since this list was generated.{" "}
            <button
              type="button"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="underline text-(--recipe-accent) hover:opacity-80 disabled:opacity-50"
            >
              Regenerate
            </button>{" "}
            to update.
          </span>
        </div>
      )}

      {/* No list yet */}
      {!list && (
        <div className="rounded-xl border border-(--recipe-border) bg-(--recipe-surface) px-4 py-6 text-center">
          <p className="text-sm text-(--recipe-muted)">
            Generate a shopping list from your meal plan.
          </p>
        </div>
      )}

      {/* List items */}
      {list && (
        <div className="rounded-xl border border-(--recipe-border) bg-(--recipe-surface) overflow-hidden">
          {list.items.length === 0 && (
            <p className="px-4 py-4 text-sm text-(--recipe-muted) text-center">
              No ingredients — add a custom item below.
            </p>
          )}

          {unchecked.length > 0 && (
            <ul className="divide-y divide-(--recipe-border)">
              {unchecked.map((item) => (
                <ItemRow key={item.id} item={item} planId={planId} />
              ))}
            </ul>
          )}

          {checked.length > 0 && (
            <>
              {unchecked.length > 0 && (
                <div className="border-t border-(--recipe-border) px-3 py-1">
                  <span className="text-xs text-(--recipe-muted) uppercase tracking-wide">
                    Checked ({checked.length})
                  </span>
                </div>
              )}
              <ul className="divide-y divide-(--recipe-border)">
                {checked.map((item) => (
                  <ItemRow key={item.id} item={item} planId={planId} />
                ))}
              </ul>
            </>
          )}

          {/* Add item footer */}
          <div className="border-t border-(--recipe-border) px-3 py-2">
            {showAddForm ? (
              <AddItemForm planId={planId} onDone={() => setShowAddForm(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 w-full min-h-11 text-sm text-(--recipe-muted) hover:text-(--recipe-text) transition-colors"
              >
                <PlusIcon className="size-4" />
                Add custom item
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
