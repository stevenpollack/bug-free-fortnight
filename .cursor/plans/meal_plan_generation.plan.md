# Meal Plan Generation — Implementation Plan

## Context

Users want to generate a full week of dinners from a free-form prompt (e.g. "5 weeknight dinners, kid-friendly, one vegetarian"). Output may **mix** existing recipes from the user's library with new recipes the LLM invents inline. The flow mirrors recipe generation: in-app path when a key is available, copy-prompt + paste-JSON escape hatch when not.

This builds on:
- `copy_prompt_sheet_refactor.plan.md` (sheet pattern with copy + paste tab)
- `byo_api_key.plan.md` (X-Anthropic-Key header passthrough)

---

## API

### `POST /api/meal-plans/generate`

One endpoint covers both flows. Body is a discriminated union:

```ts
const MealPlanGenerateBody = z.object({
  planId: z.string().uuid(),
}).and(
  z.union([
    z.object({ prompt: z.string().min(1).max(1000) }),
    z.object({ rawJson: z.string().min(1) }),
  ]),
);
```

- `prompt`: server calls Anthropic, parses, applies.
- `rawJson`: server skips Anthropic, validates the JSON against `LlmMealPlanOutput`, applies. This is the paste-JSON escape hatch's destination.

Both paths share a single atomic apply function; the only difference is where the output JSON came from.

### `GET /api/schemas/meal-plan`

Mirrors `/api/schemas/recipe`. Returns `z.toJSONSchema(LlmMealPlanOutput)`. Drives the copy-prompt button on the client and serves as the source of truth for any LLM the user pastes the prompt into.

---

## Schemas (`packages/api/src/schemas/index.ts`)

```ts
export const DayOfWeek = z.enum(["mon","tue","wed","thu","fri","sat","sun"]);

export const GeneratedSlot = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("existing"),
    day: DayOfWeek,
    recipeId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("new"),
    day: DayOfWeek,
    recipe: RecipeCreate,            // reuse existing schema
  }),
]);

export const LlmMealPlanOutput = z.object({
  slots: z.array(GeneratedSlot),
});
```

The LLM is told to return `LlmMealPlanOutput` exactly. The schema is embedded into the prompt via `z.toJSONSchema`.

---

## LLM Prompt Strategy

Pass the user's library as a compact list: `[{ id, title, tags }]` only. Strip ingredients, instructions, notes. Cap at ~150 entries (favourites first, then keyword-match the prompt against tag names, then by recency). Anything beyond the cap is truncated server-side with a `truncated: true` flag in the system prompt so the LLM knows it doesn't see everything.

System prompt structure:
1. Role: meal planner for a household.
2. Instruction: prefer reusing existing recipes by id when they fit; only invent when nothing matches.
3. Embedded JSON Schema for `LlmMealPlanOutput`.
4. Library list (compact, see above).

User prompt: the raw user text plus the day count if specified.

---

## Atomic Apply

Single transaction in `generateMealPlan.ts`:

```
db.transaction(async tx => {
  // 1. Verify all "existing" recipeIds actually exist
  const referencedIds = slots.filter(s => s.type === "existing").map(s => s.recipeId);
  const found = await tx.select({ id: recipes.id }).from(recipes).where(inArray(recipes.id, referencedIds));
  if (found.length !== referencedIds.length) {
    throw new HttpError(422, "GENERATION_INVALID_REFERENCE", "LLM referenced an unknown recipe");
  }

  // 2. Insert new recipes, capture ids
  for (const slot of slots) {
    let recipeId: string;
    if (slot.type === "existing") {
      recipeId = slot.recipeId;
    } else {
      recipeId = newId();
      await tx.insert(recipes).values({ id: recipeId, ...slot.recipe });
      // ingredients via existing pattern
    }
    await tx.insert(mealPlanSlots)
      .values({ planId, dayOfWeek: slot.day, recipeId })
      .onConflictDoUpdate({ target: [mealPlanSlots.planId, mealPlanSlots.dayOfWeek], set: { recipeId } });
  }
});
```

Any failure rolls back entirely. Existing slots in the plan that the LLM didn't fill are left untouched (so users can partially regenerate by prompting "fill the empty days"). Document this behaviour clearly in the prompt and the UI.

---

## Frontend

### Sheet

`GenerateMealPlanSheet.tsx` — same pattern as `GenerateRecipeSheet`:
- Generate tab (visible when `useCanGenerate()` is true): prompt textarea, day-count optional, dietary notes optional, Generate button.
- Paste tab: "Copy prompt for ChatGPT / Claude" full-width button above the paste textarea, pulse on copy (same pattern as the recipe sheet), submit applies via `rawJson` path.
- Loading state: pulsing icon + "Planning your week…".
- On success: close sheet, refetch plan, show toast.
- On error: stay in sheet, show inline banner.

### Entry point

Button in the `MealPlanDetail` header next to "Set as this week", labeled "Generate". Opens the sheet for that plan.

### Hooks & client

`packages/web/src/api/queries.ts`:
- `useGenerateMealPlan(planId)` — mutation accepting either `{ prompt }` or `{ rawJson }`.
- `useMealPlanSchema()` — query, infinite staleTime (matches `useRecipeSchema`).

`packages/web/src/api/client.ts`:
- `generateMealPlan(planId, body)` using the same `genReq()` wrapper introduced in the BYO key plan.
- `getMealPlanSchema()`.

### Prompt builder

`packages/web/src/lib/mealPlanPrompt.ts`:
- `buildMealPlanPrompt(schema, libraryRecipes)` — string output, structurally parallel to `buildRecipePrompt`.
- Library passed in by the component, sourced from the existing `useRecipesList()` query.

### Copy-prompt component

`packages/web/src/components/CopyMealPlanPromptButton.tsx` — thin wrapper that calls `buildMealPlanPrompt` then `copyToClipboard()` (the helper extracted in the copy-prompt refactor plan). Same visual pattern as `CopyRecipePromptButton`.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/api/src/schemas/index.ts` | Add `DayOfWeek`, `GeneratedSlot`, `LlmMealPlanOutput`, `MealPlanGenerateBody` |
| `packages/api/src/routes/generateMealPlan.ts` | Create — handler with `prompt` and `rawJson` branches, atomic apply |
| `packages/api/src/routes/schemas.ts` | Add `GET /schemas/meal-plan` |
| `packages/api/src/app.ts` | Mount router |
| `packages/api/src/routes/generateMealPlan.integration.test.ts` | Create |
| `packages/web/src/lib/mealPlanPrompt.ts` | Create |
| `packages/web/src/components/CopyMealPlanPromptButton.tsx` | Create |
| `packages/web/src/components/GenerateMealPlanSheet.tsx` | Create |
| `packages/web/src/api/client.ts` | Add `generateMealPlan`, `getMealPlanSchema` |
| `packages/web/src/api/queries.ts` | Add `useGenerateMealPlan`, `useMealPlanSchema` |
| `packages/web/src/pages/MealPlanDetail.tsx` | Add Generate button + sheet wiring |
| `packages/web/src/__tests__/GenerateMealPlanSheet.test.tsx` | Create |
| `packages/web/src/__tests__/mocks/handlers.ts` | Add handlers for new endpoints |

---

## Trickiest Decisions

1. **One endpoint vs. two for prompt vs. paste-JSON.** Picked one. Server branches on which field is present. Avoids duplicating the atomic apply path and keeps the surface minimal.
2. **Library token budget.** Cap at 150 entries with relevance ordering. Server-side filtering keeps the prompt small without burdening the client.
3. **Hallucinated recipe IDs.** Verify all "existing" references against the DB inside the transaction. If any are unknown, fail with 422 — do not silently fabricate. Surface the error so the user can retry; cheaper than partial state.
4. **Where Generate lives.** On `MealPlanDetail`, not the list page. The action targets a specific plan and the user wants to see the result in context.
5. **Paste-JSON UX consolidation.** Recipe and meal-plan paste flows are structurally identical but diverge enough at the schema level that sharing components isn't worth the abstraction. Keep components separate; the only shared util is `copyToClipboard.ts`.

---

## Commit Sequence

1. `feat(api): meal plan generation schemas (LlmMealPlanOutput, GeneratedSlot)`
2. `feat(api): GET /schemas/meal-plan endpoint`
3. `feat(api): POST /meal-plans/generate with prompt and rawJson paths`
4. `test(api): meal plan generation integration tests`
5. `feat(web): mealPlanPrompt builder and CopyMealPlanPromptButton`
6. `feat(web): GenerateMealPlanSheet component`
7. `feat(web): wire Generate button into MealPlanDetail`

---

## Verification

1. `bun run check` passes.
2. `bun run test:integration` passes.
3. Manual:
   - With key: open MealPlanDetail → Generate → prompt "5 weeknight dinners, one vegetarian" → sheet shows loading → plan populates with mix of existing + new recipes → all referenced existing recipes resolve to real entries.
   - Without key: Paste tab → Copy prompt → paste into Claude.ai → take resulting JSON → paste back → plan applies same way.
   - LLM hallucinates a fake recipe id → 422 surfaced as inline error in sheet, plan unchanged.
   - Generate twice on same plan → second run upserts slots (no duplicate slot rows).
