# syntax=docker/dockerfile:1.7
#
# Web image — Next.js 14 (App Router).
#
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so the
# browser-facing API URL arrives as a build ARG and changing it requires a
# rebuild. The server-side session lookup (apps/web/lib/server-auth.ts) is
# different: it runs inside this container at request time and reads
# SERVER_API_URL, which Compose points at the `api` service.
#
# Stages:
#   deps   install the workspace from the lockfile alone (cacheable layer)
#   dev    source + dev dependencies, for `next dev` with HMR
#   build  `next build` with the public env baked in
#   prod   `next start`

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-slim AS base
RUN corepack enable
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json              apps/api/package.json
COPY apps/web/package.json              apps/web/package.json
COPY packages/db/package.json           packages/db/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# dev — HMR. 0.0.0.0 so the published port is reachable from the host.
# ---------------------------------------------------------------------------
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@prodchi/web", "exec", "next", "dev", "-H", "0.0.0.0", "-p", "3000"]

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_ASHKAR_DSN=
ARG NEXT_PUBLIC_ASHKAR_PROJECT_KEY=
ARG NEXT_PUBLIC_ASHKAR_ENVIRONMENT=staging
# UI locale ('en' | 'fa'). NEXT_PUBLIC_APP_LOCALE is inlined into the client
# bundle at build time; APP_LOCALE is read server-side during SSR. Changing
# either requires a rebuild.
ARG NEXT_PUBLIC_APP_LOCALE=en
ARG APP_LOCALE=en
# Promote the build args to env vars: Next reads them while compiling, and that
# is the only moment they can reach the client bundle.
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_ASHKAR_DSN=$NEXT_PUBLIC_ASHKAR_DSN \
    NEXT_PUBLIC_ASHKAR_PROJECT_KEY=$NEXT_PUBLIC_ASHKAR_PROJECT_KEY \
    NEXT_PUBLIC_ASHKAR_ENVIRONMENT=$NEXT_PUBLIC_ASHKAR_ENVIRONMENT \
    NEXT_PUBLIC_APP_LOCALE=$NEXT_PUBLIC_APP_LOCALE \
    APP_LOCALE=$APP_LOCALE
RUN pnpm --filter @prodchi/web build

# ---------------------------------------------------------------------------
# prod
# ---------------------------------------------------------------------------
FROM build AS prod
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@prodchi/web", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
