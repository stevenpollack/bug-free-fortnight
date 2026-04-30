# Agent Instructions

This repo is for a private household recipe tracker. Build incrementally, keep the implementation simple, and preserve the constraints below unless the user changes them.

Plans for specific features live at `.cursor/plans/*.plan.md`. Read the relevant plan before starting non-trivial work on that feature.

## Stack Constraints

- TypeScript across the stack.
- Bun as the runtime and package manager. Do not use npm.
- Pin every dependency version exactly. Do not use `^`, `~`, `latest`, or semver ranges of any kind. This rule is non-negotiable.
- Frontend: React + Vite, mobile-first, installable PWA, Screen Wake Lock API for cooking mode.
- Styling: Tailwind CSS with `var(--recipe-*)` CSS custom properties. Never hardcode colors — always reference the design tokens.
- Frontend libraries: TanStack Query, TanStack Router, TanStack Form.
- Backend: Hono on Bun.
- Database: PostgreSQL.
- Data layer: Drizzle with the `postgres` (postgres-js) driver. UUIDv7 ids.
- Migrations: run on API startup behind a Postgres advisory lock. Register new migrations in `packages/api/drizzle/meta/_journal.json`.
- Validation/shared contracts: Zod schemas live in `packages/api/src/schemas/index.ts` and are re-exported to the web app via the `@api/schemas` path alias. Do not create a `packages/shared` workspace package.
- Lint/format: Biome.
- Pre-commit hooks: Husky.
- Tests: `bun test` (no Vitest).

## Product Context

The app helps a family track, plan, and cook recipes. Current features:

- Mobile-first recipe browsing and editing for phones and iPad-sized screens.
- Manual recipe entry and RecipeTin Eats URL import (JSON-LD + `parse-ingredient`).
- Editable ingredients and instructions after import; the original imported line is always preserved.
- Scaling ingredient quantities from a base servings value.
- Free-form tags with an optional category facet (e.g. `cuisine`, `method`, `meal_type`); a small canonical seed ships with the app.
- Weekly meal planner (dinner only, Mon–Sun, pin as "this week").
- Shopping list generation from meal plans with ingredient consolidation.
- AI recipe generation via Claude (feature-flagged on `ANTHROPIC_API_KEY`).
- Self-documenting recipe schema (`GET /api/schemas/recipe`) and a "Copy AI prompt" button for use with any LLM.
- Dark/light theme toggle.
- JSON export endpoint for backup.
- Hot-linked recipe images; no user-uploaded photos.

Authentication is intentionally out of scope. Assume private network or household-only deployment.

## Importer Safety Rules

Even on a private network, the importer must:

- Allowlist `https://www.recipetineats.com/*` URLs only.
- Use a 10s fetch timeout.
- Cap response size at 2 MB.
- Refuse to follow cross-origin redirects.

## UX Direction

Design for mobile first:

- One-column flows as the default.
- Large tap targets and readable kitchen-friendly spacing.
- Thumb-friendly navigation.
- Sticky primary actions where useful.
- Tablet and desktop layouts are progressive enhancements, not the baseline.
- Cooking mode on the recipe detail page engages the Screen Wake Lock API and releases it on navigation away or visibility change.
- The app must be installable as a PWA.

## Deployment Direction

Target Docker Compose only for v1:

- `app`: Bun container running the built Hono server and serving the built React app.
- `postgres`: pinned Postgres image with a named volume.

Kubernetes manifests are out of scope for v1; keep the structure compatible so they can be added later.

## Completion Criteria For Agents

Before saying work is complete, run:

```sh
bun run check
```

This runs typecheck, Biome lint/format, tests, and production build. All must pass.

## Bootstrap

On a fresh checkout:

```sh
bun install
```

This triggers Husky hook installation via the `prepare` script.

## Commit Workflow

- Commit coherent increments as work progresses; do not batch unrelated changes into one commit.
- Use conventional commit messages and keep them brief.
- Author every commit as the agent's model name with a `<model-slug>@noreply.local` email. Examples: `GPT-5.5 <gpt-5.5@noreply.local>`, `Claude-Opus-4.7 <claude-opus-4.7@noreply.local>`.
- Pass `--author="Name <email>"` to `git commit`. Do not set `GIT_COMMITTER_NAME` / `GIT_COMMITTER_EMAIL` environment variables. Do not run `git config user.name` or `git config user.email`, and do not modify any global or repo-level git config.
- Do not amend commits unless the user explicitly asks.

## Engineering Preferences

- Prefer KISS, DRY, YAGNI, and SOLID.
- Keep changes scoped to the requested increment.
- Prefer existing local patterns once the repo has them.
- Add abstractions only when they remove real duplication or complexity.
- Add focused tests around risky behavior, especially recipe import parsing, ingredient parsing, ingredient scaling, and importer safeguards.

## Testing Preferences

- Component tests use `@testing-library/react` with `@happy-dom/global-registrator` and MSW for network mocking.
- Use destructured queries from `render()`, not the global `screen` object. This keeps queries scoped to the rendered container.
  ```ts
  // Correct
  const { getByRole, queryByText } = render(<Component />);
  expect(getByRole("button")).toBeInTheDocument();

  // Incorrect — do not use
  render(<Component />);
  expect(screen.getByRole("button")).toBeInTheDocument();
  ```
- Use `userEvent.setup()` before interactions (not `fireEvent`).
