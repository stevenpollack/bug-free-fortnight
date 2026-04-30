# Recipe Generation with Claude — Implementation Plan

## Context

Users want to generate new recipes using Claude AI. The flow mirrors the existing import flow: generate structured recipe data → land on RecipeForm pre-filled → user reviews/edits → saves. A backend feature flag controls whether the Generate button is shown.

---

## UX Design (from UI designer)

### Button placement

Move "+ New Recipe" out of the global nav header and into the RecipesIndex page. Add "Generate Recipe" button beside it.

**Mobile**: Inline action row below search/filters, above recipe list. Two `flex-1` buttons side-by-side.
- "New Recipe" — primary style (sage green fill)
- "Generate" — ghost/outlined style (border, muted text, SparklesIcon)
- When generation is disabled: "New Recipe" takes full width

**Desktop** (`md+`): Same row but `flex justify-end` — buttons are right-aligned, don't span full width.

### AppLayout changes

Remove the "+ New" / "+ New Recipe" button from both the mobile header and desktop header. The header becomes: logo + nav links + theme toggle + install button.

### Generation prompt form

A **bottom sheet** (same pattern as `RecipePickerSheet`):
- Handle + header "Generate Recipe" + close X
- Prompt textarea (required, 3 rows, autofocus)
- Servings number input (optional)
- Dietary notes text input (optional)
- "Generate Recipe" button (primary, full-width, disabled until prompt non-empty)

### Loading state

Stay in the sheet. Replace form with centered loading view:
- Animated SparklesIcon (CSS pulse)
- "Thinking through your recipe…"
- "This takes about 10 seconds"
- Hide X button during loading (prevent abandon mid-request)

### On success

Close sheet → navigate to `/recipes/new` with generated data in router state → `RecipeCreate` reads state, passes to `RecipeForm` via `recipeCreateToFormValues()`.

### On error

Stay in sheet, restore form, show inline error banner above the Generate button. Restore the X button.

---

## Backend

### Config endpoint

**`GET /api/config`** — returns feature flags:
```json
{ "features": { "recipeGeneration": true } }
```

Checks `!!process.env.ANTHROPIC_API_KEY` at startup. No auth needed (feature flags are not sensitive).

### Generation endpoint

**`POST /api/recipes/generate`**

Request body (Zod schema `RecipeGenerateBody`):
```ts
{
  prompt: z.string().min(1).max(1000),
  servings: z.number().int().min(1).optional(),
  dietary: z.string().max(500).optional(),
}
```

Response: `{ recipe: RecipeCreate }` — same shape as existing `RecipeCreate` Zod schema (title, description, ingredients, instructions, baseServings, etc.)

Error responses:
- 503 `{ code: "GENERATION_UNAVAILABLE", message: "Recipe generation is not configured" }` — API key missing
- 422 `{ code: "GENERATION_FAILED", message: "..." }` — Claude returned unparseable output
- 429 `{ code: "RATE_LIMITED", message: "..." }` — Claude rate limit hit

### Claude integration

- Use `@anthropic-ai/sdk` (pinned exact version)
- System prompt instructs Claude to return a JSON object matching `RecipeCreate` schema
- Parse response with Zod; if parse fails → 422
- Model: `claude-sonnet-4-6` (fast, cheap, good enough for recipe generation)
- Max tokens: 4096

### Environment

- `ANTHROPIC_API_KEY` — required for generation to work. If absent, `/api/config` reports `recipeGeneration: false` and `/api/recipes/generate` returns 503.

---

## Zod Schemas (`packages/api/src/schemas/index.ts`)

```ts
export const RecipeGenerateBody = z.object({
  prompt: z.string().min(1).max(1000),
  servings: z.number().int().min(1).optional(),
  dietary: z.string().max(500).optional(),
});
export type RecipeGenerateBody = z.infer<typeof RecipeGenerateBody>;
```

---

## API Routes

### `packages/api/src/routes/config.ts` (new)
- `GET /api/config` → reads env, returns feature flags

### `packages/api/src/routes/generate.ts` (new)
- `POST /api/recipes/generate` → validates body, calls Claude, parses response, returns RecipeCreate-shaped data
- No DB write — generation only

Mount both in `packages/api/src/app.ts`.

---

## Frontend

### API client additions (`packages/web/src/api/client.ts`)

```ts
interface AppConfig { features: { recipeGeneration: boolean } }
getConfig(): Promise<AppConfig>
generateRecipe(body: { prompt: string; servings?: number; dietary?: string }): Promise<{ recipe: RecipeCreate }>
```

### Query hooks (`packages/web/src/api/queries.ts`)

```ts
export function useAppConfig() { ... }  // queryKey: ['config'], staleTime: Infinity
export function useGenerateRecipe() { ... }  // mutation
```

### New components

**`packages/web/src/components/GenerateRecipeSheet.tsx`**
- Props: `open: boolean`, `onClose: () => void`, `onGenerated: (recipe: RecipeCreate) => void`
- Manages form state, loading state, error state
- Calls `useGenerateRecipe` mutation
- On success: calls `onGenerated(recipe)`

**`packages/web/src/components/icons.tsx`** — add `SparklesIcon`

### Modified components

**`packages/web/src/pages/RecipesIndex.tsx`**
- Add action row with "+ New Recipe" and "Generate" buttons
- Conditionally show Generate based on `useAppConfig().data?.features.recipeGeneration`
- Mount `GenerateRecipeSheet`
- On generation success: navigate to `/recipes/new` with state `{ generatedRecipe: recipe }`

**`packages/web/src/pages/RecipeCreate.tsx`**
- Read `location.state?.generatedRecipe` — if present, use `recipeCreateToFormValues(generatedRecipe)` instead of `defaultFormValues()`
- Existing `recipeCreateToFormValues` from `RecipeForm.tsx` handles the conversion

**`packages/web/src/layouts/AppLayout.tsx`**
- Remove "+ New" button from mobile header
- Remove "+ New Recipe" button from desktop header

---

## Testing

### Unit tests (`packages/api/src/routes/generate.test.ts`)

| Case | Assertion |
|------|-----------|
| Missing API key | Returns 503 with `GENERATION_UNAVAILABLE` code |
| Invalid body (empty prompt) | Returns 400 with Zod validation error |
| Valid body + Claude returns valid recipe | Returns 200 with `RecipeCreate`-shaped response |
| Claude returns unparseable JSON | Returns 422 with `GENERATION_FAILED` code |

Mock the Anthropic SDK client for these tests (no real API calls).

### Component tests (`packages/web/src/__tests__/GenerateRecipe.test.tsx`)

| Case | Assertion |
|------|-----------|
| Feature flag off | "Generate" button not rendered |
| Feature flag on | "Generate" button rendered with SparklesIcon |
| Click Generate → sheet opens | Sheet visible with textarea + servings + dietary inputs |
| Submit with empty prompt | Button disabled, no request made |
| Submit with prompt → loading | Form replaced by loading view, X hidden |
| Successful generation | Sheet closes, navigation triggered with recipe state |
| Generation fails (500) | Error banner shown in sheet, form restored, X restored |
| Generation fails (503) | Error message mentions configuration |

MSW handlers:
- `GET /api/config` → `{ features: { recipeGeneration: true } }` (default)
- `POST /api/recipes/generate` → happy path returns canned recipe
- Override handlers for error cases

### Component tests (`packages/web/src/__tests__/RecipesIndex.test.tsx` — extend existing)

| Case | Assertion |
|------|-----------|
| "+ New Recipe" button in page body (not header) | Button visible in action row |
| Click "+ New Recipe" | Navigates to /recipes/new |
| Generate button hidden when flag off | Not in DOM |

### Integration tests (`packages/api/src/routes/generate.integration.test.ts`)

| Case | Assertion |
|------|-----------|
| `GET /api/config` returns features | Correct shape |
| `POST /api/recipes/generate` without API key | 503 |
| `POST /api/recipes/generate` with mocked Claude | Returns valid RecipeCreate |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/api/src/routes/config.ts` | Create |
| `packages/api/src/routes/generate.ts` | Create |
| `packages/api/src/schemas/index.ts` | Add `RecipeGenerateBody` |
| `packages/api/src/app.ts` | Mount new routes |
| `packages/api/package.json` | Add `@anthropic-ai/sdk` (pinned) |
| `packages/web/src/api/client.ts` | Add `getConfig`, `generateRecipe` |
| `packages/web/src/api/queries.ts` | Add `useAppConfig`, `useGenerateRecipe` |
| `packages/web/src/components/GenerateRecipeSheet.tsx` | Create |
| `packages/web/src/components/icons.tsx` | Add `SparklesIcon` |
| `packages/web/src/pages/RecipesIndex.tsx` | Add action row + sheet |
| `packages/web/src/pages/RecipeCreate.tsx` | Read router state for generated recipe |
| `packages/web/src/layouts/AppLayout.tsx` | Remove + New buttons from header |
| `packages/api/src/routes/generate.test.ts` | Create |
| `packages/web/src/__tests__/GenerateRecipe.test.tsx` | Create |
| `packages/web/src/__tests__/RecipesIndex.test.tsx` | Extend |

---

## Commit Sequence

1. `feat(api): add /api/config endpoint with feature flags`
2. `feat(api): add RecipeGenerateBody schema`
3. `feat(api): recipe generation endpoint with Claude integration`
4. `test(api): generation endpoint unit tests`
5. `feat(web): SparklesIcon + GenerateRecipeSheet component`
6. `feat(web): move action buttons to RecipesIndex + wire up generation`
7. `refactor(web): remove +New button from AppLayout header`
8. `test(web): GenerateRecipe component tests`

---

## Verification

1. `bun run check` — all pass
2. Component tests verify: flag-gating, sheet lifecycle, loading/error/success states
3. Unit tests mock Anthropic SDK — no real API calls in CI
4. Manual test: set `ANTHROPIC_API_KEY` in `.env.development.local`, generate a recipe, verify form pre-fills correctly, save it
