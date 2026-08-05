# ---------------------------------------------------------------------------
# Base — shared by every stage.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /usr/src/app
# Prisma needs OpenSSL; dumb-init gives us correct PID-1 signal handling.
RUN apk add --no-cache openssl dumb-init

# ---------------------------------------------------------------------------
# Dependencies — cached layer, only re-runs when manifests change.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---------------------------------------------------------------------------
# Development — hot reload, source is bind-mounted by docker-compose.
# ---------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["dumb-init", "npm", "run", "start:dev"]

# ---------------------------------------------------------------------------
# Build — compile TypeScript, then prune to production dependencies.
# ---------------------------------------------------------------------------
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

# ---------------------------------------------------------------------------
# Production — minimal runtime, non-root.
# ---------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/package.json ./package.json
USER node
EXPOSE 4000
CMD ["dumb-init", "node", "dist/main"]
