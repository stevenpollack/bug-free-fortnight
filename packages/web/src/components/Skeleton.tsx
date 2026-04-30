/** Single animated skeleton block. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-(--recipe-surface-raised) ${className}`}
      aria-hidden="true"
    />
  );
}

/** Recipe card skeleton for the list page. */
export function RecipeCardSkeleton() {
  return (
    <div className="rounded-xl border border-(--recipe-border) bg-(--recipe-surface) p-4 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

/** Detail page skeleton. */
export function RecipeDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/4" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2 mt-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
