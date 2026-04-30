import type { Tag } from "../api/client";

// A simple deterministic colour per category using a hash
function categoryColor(category: string | null): string {
  if (!category) return "bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-200";
  const categories: Record<string, string> = {
    cuisine: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    method: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
    meal_type: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    diet: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  };
  return categories[category] ?? "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200";
}

interface Props {
  tag: Pick<Tag, "name" | "category">;
  onRemove?: () => void;
  className?: string;
}

export function TagPill({ tag, onRemove, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium leading-tight ${categoryColor(tag.category)} ${className}`}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag.name}`}
          className="ml-0.5 -mr-0.5 rounded-full p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2"
        >
          <svg viewBox="0 0 8 8" className="size-2.5" aria-hidden="true">
            <line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" strokeWidth={1.5} />
            <line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" strokeWidth={1.5} />
          </svg>
        </button>
      )}
    </span>
  );
}
