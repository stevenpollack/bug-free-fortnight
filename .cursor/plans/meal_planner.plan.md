# Meal Planner — Implementation Plan

## Goal

Add a weekly meal planner that lets the household assign dinner recipes (or free-text notes) to each day Mon–Sun, save multiple named plans, and pin one plan as "This Week".

Shopping list generation is explicitly out of scope for this increment.

---

## Data Model

### New Drizzle tables (`packages/api/src/db/schema.ts`)

```ts
meal_plan
  id          uuid PK (UUIDv7)
  name        text nullable          -- user renames after creation
  is_active   boolean NOT NULL DEFAULT false
  created_at  timestamptz NOT NULL DEFAULT now()
  updated_at  timestamptz NOT NULL DEFAULT now()

meal_plan_slot
  id            uuid PK (UUIDv7)
  plan_id       uuid NOT NULL FK → meal_plans.id ON DELETE CASCADE
  day_of_week   text NOT NULL  -- enum: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'
  recipe_id     uuid nullable FK → recipes.id ON DELETE SET NULL
  note          text nullable  -- free-text slot (e.g. "Leftovers", "Takeaway")
  -- one slot per day per plan
  UNIQUE (plan_id, day_of_week)
```

**Invariants:**
- At most one `meal_plan` has `is_active = true` at any time; enforced at application layer (clear all, then set one).
- A slot holds either `recipe_id`, `note`, or neither (empty) — not both.
- Duplicate recipes across days in the same plan are allowed (leftovers use-case).

### Drizzle migration
Add a new numbered SQL migration file under `packages/api/src/db/migrations/`. Follow the existing naming convention.

---

## Zod Schemas (`packages/api/src/schemas/index.ts`)

```ts
export const DayOfWeek = z.enum(['mon','tue','wed','thu','fri','sat','sun']);

export const MealPlanSlotWrite = z.object({
  day_of_week: DayOfWeek,
  recipe_id: z.string().uuid().nullable().optional(),
  note: z.string().max(200).nullable().optional(),
});

export const MealPlanCreate = z.object({ name: z.string().max(100).nullable().optional() });
export const MealPlanUpdate = z.object({ name: z.string().max(100).nullable().optional() });
```

---

## API Routes (`packages/api/src/routes/mealPlans.ts`)

Mount at `/api/meal-plans` in `packages/api/src/app.ts`.

| Method | Path | Action |
|--------|------|--------|
| GET    | `/api/meal-plans` | List all plans (id, name, is_active, created_at); ordered by created_at DESC |
| POST   | `/api/meal-plans` | Create new plan (name nullable); returns created plan |
| GET    | `/api/meal-plans/:id` | Get plan + all 7 slots with recipe title/imageUrl inline |
| PATCH  | `/api/meal-plans/:id` | Update name |
| DELETE | `/api/meal-plans/:id` | Delete plan and cascade slots |
| POST   | `/api/meal-plans/:id/activate` | Set this plan as active (clear others first) |
| PUT    | `/api/meal-plans/:id/slots/:day` | Upsert a slot (recipe_id or note or both null = clear) |

Response shape for plan detail:
```json
{
  "id": "...",
  "name": "Week of 28 Apr",
  "is_active": true,
  "slots": {
    "mon": { "recipe_id": "...", "recipe_title": "Pasta Bake", "recipe_image_url": "...", "note": null },
    "tue": null,
    ...
  }
}
```

---

## Frontend

### New files
- `packages/web/src/pages/MealPlansIndex.tsx` — list of plans
- `packages/web/src/pages/MealPlanDetail.tsx` — 7-day grid + slot editing
- `packages/web/src/components/RecipePickerSheet.tsx` — bottom sheet for recipe selection

### Routes to add (`packages/web/src/router.ts`)
```
/meal-plans            → MealPlansIndex
/meal-plans/:id        → MealPlanDetail
```

### Navigation (`packages/web/src/layouts/AppLayout.tsx`)
- Add a "Planner" tab to the mobile bottom nav (alongside Recipes / Import)
- Add "Planner" link to the desktop top nav

Use a calendar or grid icon for the tab.

### MealPlansIndex
- Active plan pinned at top with a "This Week" badge
- Remaining plans listed below in created_at DESC order
- FAB / "+ New Plan" button — calls POST /api/meal-plans, then navigates to the new plan's detail page
- Each plan row: name (or "Unnamed plan" if null), created date, "Set as this week" button (if not active), delete button

### MealPlanDetail
- Editable plan name inline at top (blur to save via PATCH)
- "Set as this week" / "This Week ✓" toggle button
- Mon–Sun day cards in a single column (mobile-first)
- Each day card shows:
  - Day label (e.g. "Monday")
  - If slot filled with recipe: recipe title + thumbnail (tap title → navigate to recipe detail)
  - If slot filled with note: note text in muted style
  - If empty: "— Add dinner" placeholder
  - Tap card body → open RecipePickerSheet
  - Swipe-to-clear or a small ✕ button to clear the slot

### RecipePickerSheet
- Bottom sheet (fixed, slides up from bottom)
- Two tabs: **Recipes** | **Free text**
- Recipes tab: search input + scrollable list of all recipes (title + thumbnail); tap to assign
- Free text tab: single text input (max 200 chars) + "Save" button
- "Clear slot" action at the bottom of the sheet

### TanStack Query keys
```
['meal-plans']                       list
['meal-plans', id]                   detail
```

Invalidate `['meal-plans']` and `['meal-plans', id]` after any mutation.

---

## API Client (`packages/web/src/api/client.ts` / `queries.ts`)

Add typed fetch functions:
- `listMealPlans()`
- `getMealPlan(id)`
- `createMealPlan()`
- `updateMealPlan(id, { name })`
- `deleteMealPlan(id)`
- `activateMealPlan(id)`
- `upsertSlot(planId, day, { recipe_id?, note? })`

---

## Tests

### Unit / schema tests
- `DayOfWeek` enum validation
- `MealPlanSlotWrite` rejects both recipe_id and note set simultaneously (add a `.refine`)

### Integration tests (`packages/api/src/routes/mealPlans.integration.test.ts`)
- CRUD lifecycle: create → rename → activate → delete
- Activate clears previously active plan
- Upsert slot with recipe_id; upsert same slot with note replaces it; clear slot
- GET detail returns inline recipe title/imageUrl

---

## Commit Sequence

Commit at each logical increment:

1. `feat(db): add meal_plan and meal_plan_slot tables + migration`
2. `feat(api): meal plans CRUD routes`
3. `feat(api): meal plan slot upsert and activate endpoints`
4. `test(api): meal plans integration tests`
5. `feat(web): meal planner pages and routing`
6. `feat(web): recipe picker sheet`
7. `feat(web): planner nav tab`

---

## Completion Criteria

Before opening the PR, run:

```sh
bun run check
```

All checks must pass. Report any that could not run and why.
