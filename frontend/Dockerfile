# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /usr/src/app

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Development — Vite dev server with HMR; source is bind-mounted.
# ---------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------
# Build — static bundle.
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
# Vite inlines env vars at build time, so they must be present here.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------------------------------------------------------------------------
# Production — nginx serving the static bundle.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS production
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
