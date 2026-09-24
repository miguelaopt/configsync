# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders: real values are injected at runtime.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-secret
# NEXT_PUBLIC_* are inlined into the browser bundle at build time, so they must be build args
# (docker-compose passes them from .env). All of them are public by design.
ARG NEXT_PUBLIC_APP_URL NEXT_PUBLIC_PADDLE_CLIENT_TOKEN NEXT_PUBLIC_PADDLE_ENV
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV
# The companion ships from this site as single executables (no Node on the user's machine):
# public/csync-windows-x64.exe, public/csync-linux-x64, public/install.sh. The official Node
# binaries they are built from are downloaded once and kept in the build cache.
RUN apk add --no-cache tar xz unzip
RUN --mount=type=cache,target=/app/.cache pnpm build:companion
# The Windows app is built on a Windows runner (.github/workflows/desktop.yml) and published to the
# "desktop" release; the build fails loudly if it is missing rather than shipping a dead link.
ADD --chmod=644 https://github.com/miguelaopt/configsync/releases/download/desktop/ConfigSync.msi public/ConfigSync.msi
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# SQL migrations are applied at boot when RUN_MIGRATIONS=true (see instrumentation.ts)
COPY --from=build --chown=app:app /app/drizzle ./drizzle
USER app
EXPOSE 3000
CMD ["node", "server.js"]
