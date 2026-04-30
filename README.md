# Family Recipes

A self-hosted recipe tracker for a private household. The app is intended for tracking family favourites, importing recipes from RecipeTin Eats, editing ingredients and quantities, tagging recipes, filtering by cooking context, and scaling servings.

## Planned Stack

- Runtime and package manager: Bun
- Frontend: React, Vite, TypeScript
- Backend: Hono, TypeScript, Bun
- Shared package: TypeScript types and Zod schemas
- Database: PostgreSQL
- ORM/migrations: Drizzle
- Linting and formatting: Biome
- Git hooks: Lefthook
- Tests: Vitest
- Deployment: Docker Compose first, Kubernetes-ready structure

All dependencies should be pinned exactly. Do not use npm or semver ranges such as `^` or `~`.

## Product Goals

- Mobile-first recipe browsing and editing, optimized for phones and iPad-sized screens.
- Manual recipe entry with structured ingredients, instructions, tags, source links, notes, and servings.
- RecipeTin Eats URL import using structured recipe metadata where available, followed by a review/edit step before saving.
- Ingredient scaling from a base serving count while preserving original imported ingredient text for reference.
- Flexible tag categories so the household can add new categories without schema churn.

Suggested initial tag categories:

- Cuisine: Asian, Western, Italian, Mexican, Indian, Middle Eastern
- Method: slow cooker, one pot, pressure cooker, oven baked, air fryer, no cook
- Meal type: breakfast, lunch, dinner, snack, dessert, side
- Protein/main: chicken, beef, pork, seafood, vegetarian, tofu, legumes
- Dietary: vegetarian, vegan, gluten free, dairy free, low carb
- Practical: freezer friendly, meal prep, batch cook, weeknight, kid friendly, leftovers
- Difficulty: easy, moderate, project cook
- Occasion: family favourite, entertaining, comfort food, summer, winter

## Intended Repo Shape

```text
apps/
  api/       # Hono API running on Bun
  web/       # React + Vite SPA
packages/
  shared/    # Shared schemas and types
infra/
  docker/    # Docker-related files, if useful
  k8s/       # Kubernetes manifests
```

The production app should be deployable as one app container plus Postgres. The API can serve the built frontend assets, while the repo keeps a clean frontend/backend split.

## Verification

Scaffolding and proof-of-correctness checks come before feature work. The repo should expose a single command, likely `bun run check`, that runs the complete local quality gate.

Expected checks:

- TypeScript typecheck with `tsc`
- Biome lint and formatting validation
- Tests
- Production build

Agents should not consider implementation work complete until the relevant checks pass.
