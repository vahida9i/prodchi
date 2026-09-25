# syntax=docker/dockerfile:1.7
#
# API image — Fastify + Prisma, built from the pnpm workspace.
#
# Stages:
#   deps   install the workspace from the lockfile alone (cacheable layer)
#   dev    source + dev tooling: HMR (`pnpm dev`) and the one-shot
#          migrate/seed/reset-content containers (see the Makefile)
#   build  compile @prodchi/shared-types + @prodchi/api, generate Prisma Client
#   prod   run the compiled server with NODE_ENV=production
#
# Debian (slim) rather than Alpine on purpose: Prisma 5 resolves a glibc engine
# by default, so Alpine would additionally require
# binaryTargets = ["native", "linux-musl-openssl-3.0.x"] in schema.prisma.

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-slim AS base
# corepack reads `packageManager: pnpm@9.0.0` from the root package.json, so the
# exact pnpm version is used without a global install.
RUN corepack enable
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — manifests only, so editing source never busts the install layer.
# Every workspace manifest is needed for a valid workspace resolution.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json              apps/api/package.json
COPY apps/web/package.json              apps/web/package.json
COPY packages/db/package.json           packages/db/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# dev — everything, including dev dependencies. Doubles as the image for the
# one-shot tool containers: those run with no bind mount, so no .env file exists
# to override the environment the way seed.ts would let it.
# ---------------------------------------------------------------------------
FROM deps AS dev
COPY . .
# `prisma generate` does not connect to a database, but the CLI insists the
# datasource env var is defined; the throwaway value is scoped to this RUN and
# is not persisted into the image.
RUN pnpm --filter @prodchi/shared-types build \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    pnpm --filter db exec prisma generate
EXPOSE 4000
CMD ["pnpm", "--filter", "@prodchi/api", "dev"]

# ---------------------------------------------------------------------------
# build — production compile
# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
# shared-types ships compiled (package.json -> ./dist), so it is built first.
RUN pnpm --filter @prodchi/shared-types build \
 && pnpm --filter @prodchi/api build \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    pnpm --filter db exec prisma generate

# ---------------------------------------------------------------------------
# prod
# ---------------------------------------------------------------------------
FROM build AS prod
ENV NODE_ENV=production
EXPOSE 4000
# dist/server.js runs under plain node: the API's tsconfig sets
# rewriteRelativeImportExtensions, so `./routes/auth.ts` is emitted as
# `./routes/auth.js`. (Source and dev deps are still present in this stage —
# deliberate: a reliable image beats a smaller one, and `pnpm deploy` pruning
# can be layered on later if size becomes a concern.)
CMD ["node", "apps/api/dist/server.js"]
