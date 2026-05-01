# Hono RPC Migration — Implementation Plan

## Context

The frontend maintains ~30 manually-typed interfaces in `packages/web/src/api/client.ts` that mirror API response shapes. These can drift from actual route responses. Hono RPC (`hc<AppType>()`) provides end-to-end type safety by inferring request/response types from route definitions. This eliminates the manual type layer entirely.

---

## Prerequisites

- Backend DRY cleanup complete (shared helpers extracted, routes simplified).
- `@hono/zod-validator` already in use on all input-validated routes.

---

## Phase 1: Refactor routes to export typed chains

Hono RPC requires routes to be written as chained methods on a router instance, with the result captured and exported. Current pattern:

```ts
// current — types not captured
const router = new Hono<HonoEnv>();
router.get("/recipes", zValidator("query", schema), async (c) => { ... });
```

Target pattern:

```ts
// target — types inferred from return value
const router = new Hono<HonoEnv>()
  .get("/recipes", zValidator("query", schema), async (c) => {
    return c.json({ recipes });
  })
  .get("/recipes/:id", zValidator("param", schema), async (c) => {
    return c.json({ recipe });
  })
  .post("/recipes", zValidator("json", schema), async (c) => {
    return c.json({ recipe }, 201);
  });

export type RecipeRoutes = typeof router;
```

Key rule: the `router` variable must be assigned the full chain (not `.use()` then separate `.get()` calls) so TypeScript captures the full union type.

### Files to modify

Every route file in `packages/api/src/routes/`:
- `recipes.ts`
- `tags.ts`
- `import.ts`
- `generate.ts`
- `generateMealPlan.ts`
- `mealPlans.ts`
- `shoppingList.ts`
- `schemas.ts`
- `export.ts`
- `config.ts`
- `log.ts`
- `anthropicKey.ts`

### App type export

`packages/api/src/app.ts` must export the full app type:

```ts
const app = new Hono<HonoEnv>()
  .route("/api", recipeRouter)
  .route("/api", tagRouter)
  // ... all routes chained
  ;

export type AppType = typeof app;
```

Create a barrel export at `packages/api/src/index.ts` (or use the existing entry) so the web package can import `AppType` via the `@api/...` path alias without importing runtime code.

---

## Phase 2: Replace frontend client with `hc<AppType>()`

### Install dependency

```bash
bun add -E hono   # web package needs hono for the `hc` client (types only at runtime — it's a thin fetch wrapper)
```

### New client

Replace `packages/web/src/api/client.ts` with:

```ts
import { hc } from "hono/client";
import type { AppType } from "@api/app";
import { getAnthropicKey } from "../lib/anthropicKey";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export const client = hc<AppType>(API_BASE, {
  headers: () => {
    const key = getAnthropicKey();
    return key ? { "X-Anthropic-Key": key } : {};
  },
});
```

### Response type inference

With `hc`, call sites look like:

```ts
const res = await client.api.recipes.$get({ query: { q: "chicken" } });
const data = await res.json(); // fully typed as { recipes: RecipeListItem[] }
```

### Migration of query hooks

`packages/web/src/api/queries.ts` call sites change from:

```ts
queryFn: () => client.getRecipes(params)
```

to:

```ts
queryFn: async () => {
  const res = await client.api.recipes.$get({ query: params });
  return res.json();
}
```

The `select` transforms in TanStack Query hooks stay the same.

### Delete manual types

Remove all manually-defined interfaces from the old `client.ts`: `Recipe`, `RecipeListItem`, `RecipeDetail`, `Ingredient`, `Tag`, `MealPlanDetail`, `MealPlanListItem`, `ShoppingList`, `ShoppingListItem`, etc. These are now inferred from `AppType`.

If any component imports these types directly, switch them to inferred types:

```ts
import type { InferResponseType } from "hono/client";
type RecipeDetail = InferResponseType<typeof client.api.recipes[":id"]["$get"]>["recipe"];
```

Or create a `packages/web/src/api/types.ts` that re-exports these inferred types for convenience.

### Error handling

`hc` returns raw `Response` objects. The existing `ApiError` class stays; wrap it:

```ts
async function assertOk<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) {
    const { code, message } = (json as any).error ?? {};
    throw new ApiError(res.status, code ?? "UNKNOWN", message ?? res.statusText);
  }
  return json as T;
}
```

Or: create a thin wrapper that all query functions use.

---

## Path alias setup

The web package already has `@api/schemas` aliased. We need `@api/app` (or `@api/types`) to resolve to the API's type export. Update `packages/web/tsconfig.json`:

```json
"paths": {
  "@api/schemas": ["../api/src/schemas/index.ts"],
  "@api/app": ["../api/src/app.ts"]
}
```

And the corresponding Vite alias in `vite.config.ts`.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/api/src/routes/*.ts` (all) | Refactor to chained method style, export route types |
| `packages/api/src/app.ts` | Chain all `.route()` calls, export `AppType` |
| `packages/web/package.json` | Add `hono` dependency (for `hc` client) |
| `packages/web/tsconfig.json` | Add `@api/app` path alias |
| `packages/web/vite.config.ts` | Add `@api/app` resolve alias |
| `packages/web/src/api/client.ts` | Rewrite with `hc<AppType>()` |
| `packages/web/src/api/queries.ts` | Update all queryFn/mutationFn to use new client shape |
| `packages/web/src/api/types.ts` | Create — re-export inferred response types for component use |
| `packages/web/src/__tests__/mocks/handlers.ts` | May need response shape adjustments if types change |
| Components importing from `client.ts` | Update type imports to `types.ts` |

---

## Commit Sequence

1. `refactor(api): convert route files to chained method style for RPC type inference`
2. `refactor(api): export AppType from app.ts`
3. `feat(web): add hono dependency and @api/app path alias`
4. `refactor(web): replace manual client with hc<AppType>() typed client`
5. `refactor(web): update all query hooks to use new client`
6. `chore(web): remove dead manual type definitions`

---

## Risks / Notes

- **Chained route style is less readable for large routers.** Mitigate by keeping each route file focused (they already are) and using line breaks between methods.
- **`hc` adds a runtime dependency on `hono` in the web package.** It's lightweight (~2KB for the client) and tree-shakes well.
- **MSW handlers mock at the fetch level** — they don't care about the client wrapper, so they should continue working unchanged. The response shapes must still match what the API actually returns.
- **`InferResponseType` can be verbose.** The `types.ts` barrel keeps component imports clean.

---

## Verification

`bun run check` must pass after each commit. Manual verification: open the app, confirm recipes load, create/edit/delete still works, generation flows work.
