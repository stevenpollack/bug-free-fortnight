# syntax=docker/dockerfile:1

# ── Stage 1: install all dependencies (including devDeps needed for the build) ─
FROM oven/bun:1.3.12-alpine AS deps

WORKDIR /build

# Copy manifests first so this layer is cached when source changes but deps don't.
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN bun install --frozen-lockfile --production=false

# ── Stage 2: build the web app and typecheck the API ─────────────────────────
FROM deps AS build

# Copy the rest of the source on top of the installed node_modules.
COPY . .

# Build the React/Vite SPA (output: apps/web/dist/)
RUN bun run --cwd apps/web build

# Typecheck the API (tsc --noEmit); ensures the image never ships broken code.
RUN bun run --cwd apps/api build

# ── Stage 3: lean runtime image ───────────────────────────────────────────────
FROM oven/bun:1.3.12-alpine AS runtime

# The oven/bun image ships with a non-root 'bun' user (uid 1000).
# Run the process as that user for defence-in-depth.
USER bun
WORKDIR /app

# Copy workspace manifests so bun can resolve the workspace graph on prod install.
# Both apps/web and apps/api are workspace members declared in the root package.json,
# so both manifests must exist for bun install to succeed even though only the API runs here.
COPY --chown=bun:bun package.json bun.lock bunfig.toml ./
COPY --chown=bun:bun apps/api/package.json ./apps/api/
COPY --chown=bun:bun apps/web/package.json ./apps/web/

# Install production dependencies only (no devDeps).
RUN bun install --frozen-lockfile --production

# Copy API source and migration files required at runtime.
COPY --chown=bun:bun apps/api/src ./apps/api/src
COPY --chown=bun:bun apps/api/drizzle ./apps/api/drizzle
COPY --chown=bun:bun apps/api/tsconfig.json ./apps/api/tsconfig.json

# Copy the built SPA from the build stage.
COPY --chown=bun:bun --from=build /build/apps/web/dist ./web/dist

ENV NODE_ENV=production
ENV WEB_DIST_DIR=/app/web/dist
ENV PORT=3001

EXPOSE 3001

# Health-check: ping the API health endpoint every 30 s.
# start_period gives migrations time to complete before Docker starts counting failures.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "apps/api/src/index.ts"]
