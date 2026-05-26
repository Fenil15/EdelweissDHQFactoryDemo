# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the Angular frontend, served by nginx.
# IMPORTANT: build from the repo root so npm workspaces resolve.
#   docker build -f apps/frontend/Dockerfile -t edelweiss-frontend .

# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm ci

# ---------- build: ng build --configuration=production ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend ./apps/frontend
RUN npm run build --workspace=apps/frontend -- --configuration=production

# ---------- runtime: serve dist/ with nginx + SPA fallback + /api proxy ----------
FROM nginx:alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
