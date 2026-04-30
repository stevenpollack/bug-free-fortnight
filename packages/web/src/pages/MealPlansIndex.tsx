import { useNavigate } from "@tanstack/react-router";
import {
  useActivateMealPlan,
  useCreateMealPlan,
  useDeleteMealPlan,
  useMealPlansList,
} from "../api/queries";
import { Page } from "../components/Page";
import { CalendarIcon, PlusIcon, TrashIcon } from "../components/icons";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MealPlansIndex() {
  const navigate = useNavigate();
  const { data: plans = [], isLoading, error } = useMealPlansList();
  const createPlan = useCreateMealPlan();
  const deletePlan = useDeleteMealPlan();
  const activatePlan = useActivateMealPlan();

  const handleCreate = async () => {
    const result = await createPlan.mutateAsync(null);
    navigate({ to: "/meal-plans/$id", params: { id: result.mealPlan.id } });
  };

  const activePlan = plans.find((p) => p.is_active);
  const otherPlans = plans.filter((p) => !p.is_active);

  return (
    <Page className="py-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-(--recipe-text)">Meal Plans</h1>
        <button
          type="button"
          onClick={handleCreate}
          disabled={createPlan.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-(--recipe-primary) hover:bg-[#b8c59f] active:bg-[#97a67d] text-(--recipe-primary-text) px-3 py-2 text-sm font-medium min-h-11 transition-colors disabled:opacity-50"
        >
          <PlusIcon className="size-4" />
          New Plan
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-(--recipe-border) bg-(--recipe-surface) p-4 h-20 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-[#2f1f1b] border border-(--recipe-destructive) p-6 text-center">
          <p className="text-(--recipe-destructive) font-medium">Failed to load meal plans</p>
          <p className="text-sm text-[#e6a092] mt-1">{(error as Error).message}</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-(--recipe-border) p-10 text-center">
          <CalendarIcon className="size-12 text-(--recipe-muted) mx-auto mb-3" />
          <p className="text-(--recipe-muted) mb-4">No meal plans yet</p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={createPlan.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-(--recipe-primary) px-5 py-3 text-(--recipe-primary-text) font-semibold hover:bg-[#b8c59f] transition-colors"
          >
            <PlusIcon className="size-5" />
            Create First Plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active plan pinned at top */}
          {activePlan && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-(--recipe-muted) mb-2">
                This Week
              </p>
              <PlanCard
                plan={activePlan}
                isActive
                onOpen={() => navigate({ to: "/meal-plans/$id", params: { id: activePlan.id } })}
                onDelete={() => deletePlan.mutate(activePlan.id)}
                onActivate={() => activatePlan.mutate(activePlan.id)}
                isDeleting={deletePlan.isPending && deletePlan.variables === activePlan.id}
                isActivating={activatePlan.isPending && activatePlan.variables === activePlan.id}
              />
            </div>
          )}

          {/* Other plans */}
          {otherPlans.length > 0 && (
            <div>
              {activePlan && (
                <p className="text-xs font-semibold uppercase tracking-wider text-(--recipe-muted) mb-2 mt-4">
                  Other Plans
                </p>
              )}
              <div className="space-y-3">
                {otherPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isActive={false}
                    onOpen={() => navigate({ to: "/meal-plans/$id", params: { id: plan.id } })}
                    onDelete={() => deletePlan.mutate(plan.id)}
                    onActivate={() => activatePlan.mutate(plan.id)}
                    isDeleting={deletePlan.isPending && deletePlan.variables === plan.id}
                    isActivating={activatePlan.isPending && activatePlan.variables === plan.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

interface PlanCardProps {
  plan: { id: string; name: string | null; is_active: boolean; created_at: string };
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onActivate: () => void;
  isDeleting: boolean;
  isActivating: boolean;
}

function PlanCard({
  plan,
  isActive,
  onOpen,
  onDelete,
  onActivate,
  isDeleting,
  isActivating,
}: PlanCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 bg-(--recipe-surface) transition-colors ${
        isActive ? "border-(--recipe-primary)" : "border-(--recipe-border)"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left mb-3 min-h-11 flex flex-col justify-center"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-(--recipe-text)">{plan.name ?? "Unnamed plan"}</span>
          {isActive && (
            <span className="text-xs font-medium rounded-full bg-(--recipe-chip-bg) text-(--recipe-chip-text) px-2 py-0.5">
              This Week
            </span>
          )}
        </div>
        <p className="text-xs text-(--recipe-muted) mt-0.5">
          Created {formatDate(plan.created_at)}
        </p>
      </button>

      <div className="flex items-center gap-2">
        {!isActive && (
          <button
            type="button"
            onClick={onActivate}
            disabled={isActivating}
            className="flex-1 rounded-lg border border-(--recipe-primary) text-(--recipe-primary) px-3 py-2 text-sm font-medium min-h-9 hover:bg-(--recipe-chip-bg) transition-colors disabled:opacity-50"
          >
            {isActivating ? "Setting…" : "Set as this week"}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!confirm(`Delete "${plan.name ?? "Unnamed plan"}"? This cannot be undone.`)) return;
            onDelete();
          }}
          disabled={isDeleting}
          className="flex items-center justify-center rounded-lg border border-(--recipe-destructive) text-(--recipe-destructive) p-2 min-h-9 min-w-9 hover:bg-[#2f1f1b] transition-colors disabled:opacity-50"
          aria-label="Delete plan"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
