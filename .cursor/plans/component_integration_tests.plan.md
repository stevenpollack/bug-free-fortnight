# Component Integration Tests — Implementation Plan

## Context

The app has unit tests (pure logic) and integration tests (API + real DB), but nothing testing the React UI layer in isolation. Components make fetch calls, render conditional states, and interact with each other — none of which is covered. Additionally, there are no error boundaries, so unhandled errors crash the app silently. This plan adds:

1. Test infrastructure (happy-dom, RTL, MSW)
2. Component integration tests covering happy and unhappy paths
3. A root error boundary + global error listeners that log to `/api/log`

---

## Infrastructure Setup

### Dependencies to install (all pinned exactly)

```sh
bun add -D -E @happy-dom/global-registrator @testing-library/react @testing-library/user-event @testing-library/jest-dom msw
```

### Files to create

**`packages/web/happydom.ts`** — preload for bun test
```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
```

**`packages/web/bunfig.toml`** — add test preload
```toml
[test]
preload = ["./happydom.ts"]
```

If a `bunfig.toml` already exists, merge the `[test]` section.

**`packages/web/src/__tests__/setup.ts`** — RTL cleanup + MSW server lifecycle
```ts
import { afterEach, afterAll, beforeAll } from "bun:test";
import { cleanup } from "@testing-library/react";
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());
```

**`packages/web/src/__tests__/mocks/handlers.ts`** — default MSW handlers (happy-path)
Return canned responses for:
- `GET /api/meal-plans` → list with 1 active plan
- `GET /api/meal-plans/:id` → plan detail with slots
- `GET /api/meal-plans/:id/shopping-list` → null (not yet generated)
- `POST /api/meal-plans/:id/shopping-list/generate` → list with items
- `PATCH /api/meal-plans/:id/shopping-list/items/:itemId` → toggled item
- `GET /api/recipes` → list of recipes
- `GET /api/recipes/:id` → recipe detail
- `POST /api/log` → 204 (capture calls for assertion)

**`packages/web/src/__tests__/mocks/server.ts`** — MSW setup
```ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
export const server = setupServer(...handlers);
```

**`packages/web/src/__tests__/renderWithProviders.tsx`** — test wrapper
Wraps component under test with:
- `QueryClientProvider` (fresh client per test, `retry: false`)
- A minimal TanStack Router context using `createMemoryHistory` + `createRouter`

This is the trickiest part. Approach: create a one-route test router that renders the component at the expected path, with params injected via `initialEntries`.

---

## Test Files

### `packages/web/src/__tests__/ShoppingList.test.tsx`

| Scenario | Assertion |
|----------|-----------|
| No list generated yet | Shows "Generate" button and prompt text |
| Click Generate | Items appear, button changes to "Regenerate" |
| Check an item | Item gets strikethrough / moves to checked section |
| Uncheck an item | Moves back to unchecked section |
| Add custom item | Input clears, new item appears in list |
| Delete an item | Item disappears |
| Staleness banner | Shows when `plan_updated_at > generated_at` |
| Click Regenerate | Replaces all items, clears checks |
| **Generate fails (500)** | Error message shown, logger.warn called, items don't appear |
| **Toggle fails (network)** | Checkbox reverts (optimistic rollback), error logged |

### `packages/web/src/__tests__/MealPlanDetail.test.tsx`

| Scenario | Assertion |
|----------|-----------|
| Renders 7 day cards | Monday–Sunday labels visible |
| Shows recipe name in filled slot | Recipe title rendered |
| Shows placeholder in empty slot | "— Add dinner" text visible |
| Plan name editable | Blur triggers PATCH |
| Loading state | Skeleton placeholders shown |
| **Fetch fails (500)** | Error card shown with message |
| **Activate fails** | Button doesn't change state, error logged |

### `packages/web/src/__tests__/MealPlansIndex.test.tsx`

| Scenario | Assertion |
|----------|-----------|
| Lists plans | Plan names visible |
| Active plan has badge | "This Week" badge on active plan |
| Create new plan | Calls POST, navigates to detail |
| Delete plan | Calls DELETE, plan disappears |
| **List fetch fails** | Error card shown |
| **Delete fails** | Plan stays in list, error logged |

### `packages/web/src/__tests__/RecipesIndex.test.tsx`

| Scenario | Assertion |
|----------|-----------|
| Renders recipe cards | Titles visible |
| Search filters | Only matching recipes shown |
| Favourite toggle | Heart icon toggles |
| **List fetch fails** | Error card shown |

### `packages/web/src/__tests__/ThemeToggle.test.tsx`

| Scenario | Assertion |
|----------|-----------|
| Click toggle | `document.documentElement` gets `data-theme="light"` |
| Persists to localStorage | `localStorage.getItem("theme")` === "light" |
| Reads initial from localStorage | Set before render, correct icon shown |

### `packages/web/src/__tests__/ErrorBoundary.test.tsx`

| Scenario | Assertion |
|----------|-----------|
| Child throws | Fallback UI rendered, not crash |
| Error logged to `/api/log` | MSW handler receives POST with error details |
| Unhandled promise rejection | Logged to `/api/log` |
| Window `error` event | Logged to `/api/log` |

---

## Error Boundary Implementation

### `packages/web/src/components/ErrorBoundary.tsx`

Class component (required for `componentDidCatch`):
- Catches render errors from children
- Renders a fallback: "Something went wrong" card with a "Reload" button
- Calls `logger.error(...)` with the error message and component stack

### `packages/web/src/main.tsx` changes

- Wrap `<RouterProvider>` in `<ErrorBoundary>`
- Add global listeners in the root (or in ErrorBoundary's `componentDidMount`):
  ```ts
  window.addEventListener("error", (e) => logger.error({ error: e.message }, "uncaught error"));
  window.addEventListener("unhandledrejection", (e) => logger.error({ reason: String(e.reason) }, "unhandled rejection"));
  ```

### `packages/web/src/api/queries.ts` — QueryClient defaults

Set `queryClient.setDefaultOptions`:
```ts
mutations: { onError: (err) => logger.warn({ error: err.message }, "mutation failed") }
```

This ensures all unhandled mutation errors get logged without needing per-hook `onError`.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/web/happydom.ts` | Create |
| `packages/web/bunfig.toml` | Create or modify |
| `packages/web/src/__tests__/setup.ts` | Create |
| `packages/web/src/__tests__/mocks/handlers.ts` | Create |
| `packages/web/src/__tests__/mocks/server.ts` | Create |
| `packages/web/src/__tests__/renderWithProviders.tsx` | Create |
| `packages/web/src/__tests__/ShoppingList.test.tsx` | Create |
| `packages/web/src/__tests__/MealPlanDetail.test.tsx` | Create |
| `packages/web/src/__tests__/MealPlansIndex.test.tsx` | Create |
| `packages/web/src/__tests__/RecipesIndex.test.tsx` | Create |
| `packages/web/src/__tests__/ThemeToggle.test.tsx` | Create |
| `packages/web/src/__tests__/ErrorBoundary.test.tsx` | Create |
| `packages/web/src/components/ErrorBoundary.tsx` | Create |
| `packages/web/src/main.tsx` | Wrap in ErrorBoundary + add listeners |
| `packages/web/src/api/queries.ts` | Add default mutation onError |

---

## Commit Sequence

1. `feat(web): add happy-dom, RTL, MSW test infrastructure`
2. `feat(web): ErrorBoundary component + global error listeners`
3. `feat(web): default mutation error logging in QueryClient`
4. `test(web): ShoppingList component integration tests`
5. `test(web): MealPlanDetail component integration tests`
6. `test(web): MealPlansIndex component integration tests`
7. `test(web): RecipesIndex component integration tests`
8. `test(web): ThemeToggle and ErrorBoundary tests`

---

## Verification

1. `bun run check` — all existing tests + new component tests pass
2. New tests run as part of `bun test` (no Docker needed)
3. Error boundary renders fallback when a component throws
4. MSW handler for `/api/log` receives POSTed errors during unhappy-path tests
