# Family Recipes

A self-hosted recipe tracker for a private household. The app is intended for tracking family favourites, importing recipes from RecipeTin Eats, editing ingredients and quantities, tagging recipes, filtering by cooking context, and scaling servings.

## Planned Stack

- Runtime and package manager: Bun
- Frontend: React + Vite + TypeScript, mobile-first, installable PWA, Screen Wake Lock for cooking mode
- Styling: Tailwind CSS
- Frontend libraries: TanStack Query, TanStack Router, TanStack Form
- Backend: Hono on Bun
- Database: PostgreSQL
- ORM and driver: Drizzle with the `postgres` (postgres-js) driver
- IDs: UUIDv7
- Validation: Zod (co-located in the API, re-exported to the web via a TS path alias; no separate shared package)
- Linting and formatting: Biome
- Git hooks: Husky
- Tests: `bun test`
- Deployment: Docker Compose, single app container plus Postgres

All dependencies must be pinned exactly. Do not use npm. Do not use `^`, `~`, `latest`, or any semver range.

## Product Goals

- Mobile-first browsing and editing, optimized for phones and iPad-sized screens.
- Installable as a home-screen PWA.
- Cooking mode keeps the screen awake while reading a recipe in the kitchen.
- Manual recipe entry with structured ingredients, instructions, tags, source link, notes, and base servings.
- RecipeTin Eats URL import using JSON-LD recipe metadata, with a review/edit step before saving and ingredient lines parsed into structured fields.
- Ingredient scaling from base servings while preserving the original imported text.
- Free-form tags with an optional category facet (e.g. `cuisine`, `method`, `meal_type`). A small canonical seed ships with the app; the household adds more from the UI.
- JSON export endpoint for backups, alongside `pg_dump` for full database backups.

## Importer Safety

The recipe importer is restricted in v1 to:

- Allowlist of `https://www.recipetineats.com/*` URLs.
- 10 second fetch timeout.
- 2 MB max response size.
- No cross-origin redirect following.

These constraints exist even though v1 runs on a private network.

## Intended Repo Shape

```text
apps/
  api/   # Hono API on Bun, also serves the built web app in production
  web/   # React + Vite SPA (installable PWA)
infra/
  docker/  # Dockerfile and Docker Compose
```

Schemas and types are shared between `apps/api` and `apps/web` via a TypeScript path alias, not a separate package.

## Verification

Scaffolding and proof-of-correctness checks come before feature work. The repo exposes a single command:

```sh
bun run check
```

That command runs the full local quality gate:

- TypeScript typecheck with `tsc`
- Biome lint and formatting validation
- `bun test`
- Production build

Agents must not consider implementation work complete until the relevant checks pass.

## Self-Hosting

The app ships as a single Docker Compose stack: one Bun container that serves both the Hono API and the built React SPA, backed by a Postgres database.

### Quick start

```sh
git clone <repo-url> family-recipes
cd family-recipes
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD to something strong
docker compose -f infra/docker/docker-compose.yml --env-file .env up --build
```

The app is then available at `http://localhost:3001/`.

### Data backups

Recipe data lives in the `recipes_pg_data` named volume. Two backup options:

1. **Database dump** — run `pg_dump` inside the Postgres container:

   ```sh
   docker exec family-recipes-postgres-1 pg_dump -U recipes recipes > backup.sql
   ```

2. **JSON export** — call the built-in export endpoint:

   ```sh
   curl http://localhost:3001/api/export > recipes-backup.json
   ```

### Updating

Rebuild from source with the latest code:

```sh
docker compose -f infra/docker/docker-compose.yml --env-file .env up --build
```

When a pre-built image is published to a registry, use `docker compose pull` before `up`.

### Installing to the home screen (PWA)

The app is a Progressive Web App. On **iOS** (Safari): tap the Share button → "Add to Home Screen". On **Android** (Chrome): tap the menu → "Add to Home screen" or "Install app". Once installed, the app launches full-screen and a cooking-mode screen-wake-lock keeps the display on while you follow a recipe in the kitchen.
