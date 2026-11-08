FROM oven/bun:1.4.4 AS bun

FROM node:24.19.0-bookworm-slim AS node-base

FROM node-base AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/emulate/package.json apps/emulate/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile --ignore-scripts
COPY apps/api apps/api
COPY apps/mobile apps/mobile
COPY packages/shared packages/shared
COPY tsconfig.json tsconfig.json
RUN bun run --cwd apps/api build
RUN CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_API_URL=/ \
    bun run --cwd apps/mobile expo export --platform web && test -s apps/mobile/dist/index.html

FROM bun AS dependencies
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/emulate/package.json apps/emulate/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile --production --filter @starter/api --ignore-scripts

FROM node-base
ENV NODE_ENV=production PORT=8080 EXPO_WEB_ROOT=/app/apps/api/web
WORKDIR /app/apps/api
COPY --from=dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=dependencies --chown=node:node /app/apps /app/apps
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --from=build --chown=node:node /app/apps/api/drizzle ./drizzle
COPY --from=build --chown=node:node /app/apps/api/assets ./assets
COPY --from=build --chown=node:node /app/apps/mobile/dist ./web
COPY --from=build --chown=node:node /app/apps/api/package.json ./package.json
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
