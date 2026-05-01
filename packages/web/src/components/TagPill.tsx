import type { Tag } from "../api/types";

// A simple deterministic colour per category using a hash
function categoryColor(category: string | null): string {
  if (!category) return "bg-(--recipe-chip-bg) text-(--recipe-chip-text)";
  const categories: Record<string, string> = {
    cuisine: "bg-[#3a2a1f] text-[#f0cfb2]",
    method: "bg-(--recipe-chip-bg) text-(--recipe-chip-text)",
    meal_type: "bg-[#28342d] text-[#d8e7d0]",
    diet: "bg-[#342d27] text-[#ead8c4]",
  };
  return categories[category] ?? "bg-(--recipe-surface-raised) text-(--recipe-muted)";
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
          className="ml-0.5 -mr-0.5 rounded-full p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7c58f]/40"
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
