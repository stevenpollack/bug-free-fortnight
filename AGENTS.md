# Agent Instructions

This repo is for a private household recipe tracker. Build incrementally, keep the implementation simple, and preserve the planning constraints below unless the user changes them.

The current plan lives at `.cursor/plans/recipe_tracker_app_*.plan.md`. Read it before starting non-trivial work; if it is missing, ask the user for the current plan.

## Current Priority

Before feature work, create the repo scaffold and proof-of-correctness checks:

1. Scaffold the Bun workspace (`apps/web`, `apps/api`, `infra/docker`) using Bun and Vite templates where they fit.
2. Configure Biome, Husky, Tailwind, TypeScript, `bun test`, and build scripts.
3. Establish a root `bun run check` command that runs typecheck, lint/format, tests, and build.
4. Run the checks and fix failures before moving to data or feature work.

## Stack Constraints

- TypeScript across the stack.
- Bun as the runtime and package manager. Do not use npm.
- Pin every dependency version exactly. Do not use `^`, `~`, `latest`, or semver ranges of any kind. This rule is non-negotiable.
- Frontend: React + Vite, mobile-first, installable PWA, Screen Wake Lock API for cooking mode.
- Styling: Tailwind CSS.
- Frontend libraries: TanStack Query, TanStack Router, TanStack Form.
- Backend: Hono on Bun.
- Database: PostgreSQL.
- Data layer: Drizzle with the `postgres` (postgres-js) driver. UUIDv7 ids.
- Migrations: run on API startup behind a Postgres advisory lock.
- Validation/shared contracts: Zod schemas live in the API and are re-exported to the web app via a TS path alias. Do not create a `packages/shared` workspace package.
- Lint/format: Biome.
- Pre-commit hooks: Husky.
- Tests: `bun test` (no Vitest).

## Product Context

The app should help track and edit recipes the user's family likes. It should support:

- Mobile-first recipe browsing and editing for phones and iPad-sized screens.
- Manual recipe entry.
- RecipeTin Eats URL import from pages such as `https://www.recipetineats.com/french-toast/#recipe`, using JSON-LD recipe metadata and `parse-ingredient` for ingredient lines.
- Editable ingredients and instructions after import; the original imported line is always preserved.
- Scaling ingredient quantities from a base servings value.
- Free-form tags with an optional category facet (e.g. `cuisine`, `method`, `meal_type`); seed only a small canonical set.
- JSON export endpoint for backup.
- Hot-linked recipe images in v1; no user-uploaded photos.

Authentication is intentionally out of scope for v1. Assume private network or household-only deployment.

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

Before saying work is complete, run the proof-of-correctness checks:

```sh
bun run check
```

If `check` is not yet wired up, run the closest available equivalents and report what is missing:

```sh
bun run typecheck
bun run lint
bun run build
bun test
```

Report any check that could not be run and why.

## Bootstrap

On a fresh checkout, agents should run:

```sh
bun install
```

This must trigger Husky's hook installation (e.g. via a `prepare` script). Verify hooks are installed before relying on them.

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
