# Bring-Your-Own API Key — Implementation Plan

## Context

Today, AI recipe generation requires `ANTHROPIC_API_KEY` set on the server. Users who don't control the deployment can't use it — they're forced into the copy-prompt escape hatch.

This plan adds a Settings page where any user can paste their own Anthropic API key, stored in `localStorage`. The frontend forwards it as a header on generation requests; the API prefers the header over the server env var. This unlocks in-app generation per-device without changing the deployment trust model.

The plumbing introduced here also serves the upcoming meal-plan generation feature.

---

## Trust model

- Key sits in plain `localStorage` on every device that visits. Acceptable for a private household app, but the Settings UI must say so explicitly.
- The browser **does not** call Anthropic directly. The API stays the proxy — the browser sends `X-Anthropic-Key` to our own backend, which forwards it to Anthropic. This avoids leaking the key to network tab inspectors and dodges CORS entirely.
- Server-side env var remains supported and takes lower precedence than a request header. Self-hosters who want a single shared key keep working unchanged.

---

## API changes

### Header passthrough

`packages/api/src/routes/generate.ts`:
- Read `c.req.header("x-anthropic-key")` first, fall back to `process.env.ANTHROPIC_API_KEY`.
- If neither exists → 503 with `code: "GENERATION_UNAVAILABLE"` (existing behavior).
- The Anthropic client must be constructed per-request when the header is used (don't cache a singleton built from env).

### `/api/config`

Stays unchanged in shape. `recipeGeneration` still reflects only **server** capability — the client ORs in its own localStorage key when deciding whether to show the in-app form. This keeps the endpoint cacheable and per-device key state out of the server.

### Validation endpoint

New: `POST /api/anthropic/test-key` — accepts the same `X-Anthropic-Key` header, makes one cheap call (e.g. `messages.create` with `max_tokens: 1`), returns `{ ok: true }` or a structured error with the upstream message. No body, no rate limiting beyond what Anthropic itself enforces.

---

## Frontend changes

### Settings page

New route `/settings` (TanStack Router). Mobile-first single-column form:

- **API key** (password-style input, masked, with show/hide toggle).
- **Save** button → writes to `localStorage.anthropicApiKey`.
- **Test key** button → calls `POST /api/anthropic/test-key` with the entered key, shows ✓ / ✗ inline.
- **Clear** button → removes the key from localStorage.
- Disclosure block: short paragraph explaining the key is stored unencrypted in this browser only, never sent to anyone except the household's own server, and lives at most until the user clears site data.

### Storage helper

`packages/web/src/lib/anthropicKey.ts`:
```ts
export function getAnthropicKey(): string | null;
export function setAnthropicKey(key: string): void;
export function clearAnthropicKey(): void;
```
Simple, synchronous, single-source-of-truth.

### Request plumbing

`packages/web/src/api/client.ts`:
- The `req()` helper reads `getAnthropicKey()` and adds `X-Anthropic-Key` to **only** generation-related calls. (Don't blanket-attach to every API call — keeps the key out of unrelated request logs.)
- Cleanest path: a small `genReq()` wrapper used by `generateRecipe()` (and later, `generateMealPlan()`) that injects the header.

### Feature flag

`useAppConfig()` query unchanged. Add a `useCanGenerate()` hook:
```ts
export function useCanGenerate() {
  const { data } = useAppConfig();
  const localKey = useSyncExternalStore(...); // listen to storage events
  return data?.features.recipeGeneration === true || Boolean(localKey);
}
```
Components that gate generation UI switch from reading `data.features.recipeGeneration` directly to using `useCanGenerate()`.

### Header link

Add a "Settings" link to the existing nav (gear icon, last item). On mobile, it's a row in whatever overflow menu exists; on desktop it's an icon in the header.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/web/src/lib/anthropicKey.ts` | Create |
| `packages/web/src/pages/Settings.tsx` | Create |
| `packages/web/src/router.tsx` (or wherever routes live) | Add `/settings` route |
| `packages/web/src/components/Header.tsx` (or AppLayout) | Add Settings link |
| `packages/web/src/api/client.ts` | Add `genReq()` helper, attach key header to `generateRecipe()` |
| `packages/web/src/api/queries.ts` | Add `useCanGenerate()`, `useTestAnthropicKey()` mutation |
| `packages/web/src/components/GenerateRecipeSheet.tsx` | Use `useCanGenerate()` instead of raw config flag |
| `packages/api/src/routes/generate.ts` | Read header, fall back to env, construct client per-request |
| `packages/api/src/routes/anthropicKey.ts` | Create — `POST /anthropic/test-key` |
| `packages/api/src/app.ts` | Mount new router |
| `packages/web/src/__tests__/Settings.test.tsx` | Create — render, save, test-key flows |
| `packages/web/src/__tests__/mocks/handlers.ts` | Add MSW handlers for `/api/anthropic/test-key` |

---

## Commit Sequence

1. `feat(api): accept X-Anthropic-Key header for generation, fall back to env`
2. `feat(api): add /anthropic/test-key validation endpoint`
3. `feat(web): anthropicKey storage helper + useCanGenerate hook`
4. `feat(web): Settings page with key save/test/clear`
5. `feat(web): wire X-Anthropic-Key header into generateRecipe client call`
6. `feat(web): Settings link in header nav`

---

## Verification

1. `bun run check` passes.
2. Manual:
   - With no server key and no localStorage key: in-app Generate is hidden, escape hatch shows.
   - Add a key on Settings → Test key shows ✓ → return to Recipes → Generate sheet now has the in-app Generate tab.
   - Bad key on Settings → Test key shows error from upstream.
   - Clear key → Generate tab disappears again.
   - Server with `ANTHROPIC_API_KEY` set + no localStorage key still works (regression).
   - Server with env var + localStorage key set → header wins (verify via API log of which path was used).
