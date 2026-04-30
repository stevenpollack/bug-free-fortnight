# Agent Instructions

This repo is for a private household recipe tracker. Build incrementally, keep the implementation simple, and preserve the planning constraints below unless the user changes them.

## Current Priority

Before feature work, create the repo scaffold and proof-of-correctness checks:

1. Scaffold the Bun workspace.
2. Use Bun/Vite templates where applicable instead of hand-rolling boilerplate.
3. Configure Biome, Lefthook, TypeScript, tests, and build scripts.
4. Establish a root `bun run check` command that verifies typecheck, lint/format, tests, and build.
5. Run the checks and fix failures before moving to data or feature work.

## Stack Constraints

- Use TypeScript across the stack.
- Use Bun as the runtime and package manager.
- Do not use npm.
- Pin dependency versions exactly. Do not use `^`, `~`, `latest`, or broad semver ranges.
- Planned frontend: React + Vite.
- Planned backend: Hono on Bun.
- Planned database: PostgreSQL.
- Planned data layer: Drizzle migrations and queries.
- Planned validation/shared contracts: Zod schemas in a shared package.
- Planned lint/format: Biome.
- Planned pre-commit hooks: Lefthook.
- Planned tests: Vitest.

## Product Context

The app should help track and edit recipes that the user's family likes. It should support:

- Mobile-first recipe browsing and editing for phones and iPad-sized screens.
- Manual recipe entry.
- RecipeTin Eats URL import, starting with structured recipe metadata from pages such as `https://www.recipetineats.com/french-toast/#recipe`.
- Editable ingredients and instructions after import.
- Scaling ingredient quantities by serving count.
- Flexible tags and filters for categories such as cuisine, method, meal type, protein, dietary needs, practicality, difficulty, and occasion.

Authentication is intentionally out of scope for v1. Assume private network or household-only deployment for now.

## UX Direction

Design for mobile first:

- One-column flows as the default.
- Large tap targets and readable kitchen-friendly spacing.
- Thumb-friendly navigation.
- Sticky primary actions where useful.
- Tablet and desktop layouts should be progressive enhancements, not the baseline.

## Deployment Direction

Target Docker Compose first:

- `app`: Bun container running the built Hono server and serving the built React app.
- `postgres`: pinned Postgres image with a named volume.

Keep the structure compatible with later Kubernetes manifests.

## Completion Criteria For Agents

Before saying work is complete, run the relevant proof-of-correctness checks. For most implementation tasks, this means:

```sh
bun run check
```

If the root check command is not available yet, run the closest available equivalents:

```sh
bun run typecheck
bun run lint
bun run build
bun test
```

Report any check that could not be run and why.

## Commit Workflow

- Commit coherent increments as work progresses.
- Use conventional commit messages and keep them brief.
- Use the agent model name as the git author name.
- Use a no-reply local email based on the model name, for example `GPT-5.5 <gpt-5.5@noreply.local>`.
- Do not change global or repository git config to set the author. Pass the author explicitly when committing.

## Engineering Preferences

- Prefer KISS, DRY, YAGNI, and SOLID.
- Keep changes scoped to the requested increment.
- Prefer existing local patterns once the repo has them.
- Add abstractions only when they remove real duplication or complexity.
- Add focused tests around risky behavior, especially recipe import parsing and ingredient scaling.
