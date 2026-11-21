# --- Stage 1: build the Vue PWA with pnpm ---
FROM node:22-slim AS build

WORKDIR /app

RUN npm install -g pnpm@11.2.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# --- Stage 2: serve static PWA + reverse proxy to the API ---
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80
