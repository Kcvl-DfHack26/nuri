FROM oven/bun:1.4.4 AS bun

FROM node:26.13.0-bookworm-slim AS node-base

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
    bun run --bun --cwd apps/mobile expo export --platform web && test -s apps/mobile/dist/index.html

FROM bun AS dependencies
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/emulate/package.json apps/emulate/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile --production --filter @starter/api --ignore-scripts

FROM dependencies AS preview-dependencies
RUN bun install --frozen-lockfile --production --filter @starter/api --filter @starter/mobile --ignore-scripts

FROM build AS preview-build
RUN bun build apps/api/src/seed.ts --target=node --outdir=apps/api/dist-preview --external=pg --external=@google-cloud/storage

FROM postgres:18.6-bookworm AS preview
RUN apt-get update && apt-get install -y --no-install-recommends libatomic1 nginx-light qrencode \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node-base /usr/local/bin/node /usr/local/bin/node
COPY --from=preview-dependencies --chown=postgres:postgres /app/node_modules /app/node_modules
COPY --from=preview-dependencies --chown=postgres:postgres /app/apps /app/apps
COPY package.json tsconfig.json /app/
COPY packages/shared /app/packages/shared
COPY --chown=postgres:postgres apps/mobile /app/apps/mobile
COPY --from=build /app/apps/mobile/dist /app/apps/mobile/dist
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/drizzle /app/apps/api/drizzle
COPY --from=build /app/apps/api/assets /app/apps/api/assets
COPY --from=preview-build /app/apps/api/dist-preview/seed.js /app/apps/api/dist/seed.js
COPY --from=preview-scripts preview-start.sh preview-ready.ts preview-nginx.conf /app/scripts/
WORKDIR /app
USER postgres
ENTRYPOINT []
EXPOSE 8080
CMD ["bash", "scripts/preview-start.sh"]

FROM node-base
ENV NODE_ENV=production PORT=8080 EXPO_WEB_ROOT=/app/apps/api/web
WORKDIR /app/apps/api
COPY --from=dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=dependencies --chown=node:node /app/apps /app/apps
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
COPY --from=build --chown=node:node /app/apps/api/drizzle ./drizzle
COPY --from=build --chown=node:node /app/apps/api/assets/product-kinds ./assets/product-kinds
COPY --from=build --chown=node:node /app/apps/mobile/dist ./web
COPY --from=build --chown=node:node /app/apps/api/package.json ./package.json
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
