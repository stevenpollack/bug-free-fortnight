# syntax=docker/dockerfile:1

# ── Stage 1: install all dependencies (including devDeps needed for the build) ─
FROM oven/bun:1.3.12-alpine AS deps

WORKDIR /build

# Copy manifests first so this layer is cached when source changes but deps don't.
COPY package.json bun.lock bunfig.toml ./
COPY packages/web/package.json ./packages/web/
COPY packages/api/package.json ./packages/api/
COPY packages/mcp/package.json ./packages/mcp/

RUN bun install --frozen-lockfile

# ── Stage 2: build the web app and typecheck all packages ────────────────────
FROM deps AS build

COPY . .

RUN bun run -F web build
RUN bun run -F api typecheck
RUN bun run -F mcp typecheck

# ── Stage 3: production dependencies only ────────────────────────────────────
FROM oven/bun:1.3.12-alpine AS runtime-base

# The oven/bun image ships with a non-root 'bun' user (uid 1000).
USER bun
WORKDIR /app

# All workspace manifests must be present for bun to resolve the workspace graph.
COPY --chown=bun:bun package.json bun.lock bunfig.toml ./
COPY --chown=bun:bun packages/web/package.json ./packages/web/
COPY --chown=bun:bun packages/api/package.json ./packages/api/
COPY --chown=bun:bun packages/mcp/package.json ./packages/mcp/

# --ignore-scripts skips the root `prepare` (Husky) which fails without devDeps.
RUN bun install --frozen-lockfile --production --ignore-scripts

# ── Stage 4: API + web SPA ───────────────────────────────────────────────────
FROM runtime-base AS api

COPY --chown=bun:bun packages/api/src ./packages/api/src
COPY --chown=bun:bun packages/api/drizzle ./packages/api/drizzle
COPY --chown=bun:bun packages/api/tsconfig.json ./packages/api/tsconfig.json
COPY --chown=bun:bun --from=build /build/packages/web/dist ./web/dist

ENV NODE_ENV=production
ENV WEB_DIST_DIR=/app/web/dist
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "packages/api/src/index.ts"]

# ── Stage 5: MCP server ──────────────────────────────────────────────────────
FROM runtime-base AS mcp

COPY --chown=bun:bun packages/mcp/src ./packages/mcp/src
COPY --chown=bun:bun packages/mcp/tsconfig.json ./packages/mcp/tsconfig.json

ENV NODE_ENV=production
ENV MCP_PORT=3002

EXPOSE 3002

CMD ["bun", "run", "packages/mcp/src/index.ts"]
