# Backend DRY Cleanup — Implementation Plan

## Context

An audit of `packages/api/src/routes/` identified 7 concrete DRY violations and dead code issues. This plan addresses them in a single pass before further feature work.

---

## Changes

### 1. Extract `parseNumeric` to shared util

Create `packages/api/src/lib/utils.ts`:
```ts
export function parseNumeric(val: string | null): number | null {
  if (val === null) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}
```

Remove duplicates from `routes/recipes.ts`, `routes/shoppingList.ts`, `routes/export.ts`. Import from `../lib/utils`.

### 2. Extract `buildIngredientRows` helper

Add to `packages/api/src/lib/utils.ts`:
```ts
export function buildIngredientRows(recipeId: string, ingredients: IngredientInput[]): InsertRow[] {
  return ingredients.map((ing, idx) => ({
    id: newId(),
    recipeId,
    displayOrder: ing.displayOrder ?? idx,
    groupHeading: ing.groupHeading ?? null,
    quantity: ing.quantity?.toString() ?? null,
    unit: ing.unit ?? null,
    item: ing.item,
    notes: ing.notes ?? null,
    originalLine: ing.originalLine ?? ing.item,
  }));
}
```

Replace the 3 inline `.map(...)` blocks in `recipes.ts` (POST handler, PUT handler) and `generateMealPlan.ts`.

### 3. Eliminate `c.var.logger ?? rootLogger` repetition

The `requestLogger` middleware always sets `c.var.logger`. Drop the `?? rootLogger` fallback everywhere. If a route handler ever runs without the middleware (e.g. health check), the type system will catch it via `HonoEnv`. Simply use `c.var.logger` directly — it's typed as `Logger` via `HonoEnv`.

### 4. Extract `resolveShoppingList(planId)` helper

Add to `packages/api/src/routes/shoppingList.ts` (private to file):
```ts
async function resolveShoppingList(planId: string) {
  const plan = await db.query.mealPlans.findFirst({ where: eq(mealPlans.id, planId) });
  if (!plan) throw new HttpError(404, "NOT_FOUND", "Meal plan not found");
  const list = await db.query.shoppingLists.findFirst({ where: eq(shoppingLists.planId, planId) });
  if (!list) throw new HttpError(404, "NOT_FOUND", "Shopping list not generated yet");
  return { plan, list };
}
```

Replace the repeated 3-step verification in PATCH, DELETE, and POST-item handlers.

### 5. Extract shared Anthropic call + parse helper

Create `packages/api/src/lib/anthropic.ts`:
```ts
export async function callAnthropic(apiKey: string, params: MessageCreateParams): Promise<string>;
export function parseAndValidate<T>(rawText: string, schema: ZodSchema<T>): T;
```

`callAnthropic` wraps the try/catch for `RateLimitError` and extracts the text content block. `parseAndValidate` strips markdown fences, parses JSON, validates against schema, throws `HttpError` on failure.

Replace duplicated logic in `generate.ts` and `generateMealPlan.ts`.

### 6. Remove dead try/catch in generateMealPlan.ts

Delete the no-op try/catch at ~line 283-286 where both branches throw the same `err`.

### 7. Replace dynamic import with static import in shoppingList.ts

Remove `await import("drizzle-orm")` at ~line 117 and add `inArray` to the static import at the top of the file.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/api/src/lib/utils.ts` | Create — `parseNumeric`, `buildIngredientRows` |
| `packages/api/src/lib/anthropic.ts` | Create — `callAnthropic`, `parseAndValidate` |
| `packages/api/src/routes/recipes.ts` | Remove `parseNumeric` + ingredient mapping duplication |
| `packages/api/src/routes/shoppingList.ts` | Remove `parseNumeric`, add `resolveShoppingList`, fix dynamic import |
| `packages/api/src/routes/export.ts` | Remove `parseNumeric` |
| `packages/api/src/routes/generate.ts` | Use `callAnthropic` + `parseAndValidate` |
| `packages/api/src/routes/generateMealPlan.ts` | Use helpers, remove dead try/catch |

---

## Commit Sequence

1. `refactor(api): extract parseNumeric and buildIngredientRows to shared utils`
2. `refactor(api): extract Anthropic call and parse helpers`
3. `refactor(api): extract resolveShoppingList, remove dead code and dynamic import`
4. `refactor(api): drop unnecessary logger fallbacks`

---

## Verification

`bun run check` must pass after each commit. No behaviour change — pure refactoring.
