# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the Express + TypeORM backend.
# IMPORTANT: build from the repo root so npm workspaces resolve.
#   docker build -f apps/backend/Dockerfile -t edelweiss-backend .

# ---------- deps: install all workspace deps (dev + prod) ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm ci

# ---------- build: compile TypeScript to dist/ ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/backend ./apps/backend
RUN npm run build --workspace=apps/backend

# ---------- runtime: copy dist + production deps only ----------
# Install backend's production deps as a standalone package (not via workspaces)
# so we don't drag the frontend's Angular runtime deps into the backend image.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_DIR=/data/uploads

COPY apps/backend/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force

COPY --from=build /app/apps/backend/dist ./dist

RUN mkdir -p /data/uploads

EXPOSE 3000
CMD ["node", "dist/index.js"]
