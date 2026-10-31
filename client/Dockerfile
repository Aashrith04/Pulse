# ==============================================================================
# PULSE FRONTEND SERVICE — PRODUCTION DOCKERFILE
# Multi-stage: Node 20 builder -> Minimal Nginx Alpine Static Server
# ==============================================================================

# --- Stage 1: Build & Bundle ---
FROM node:20-alpine AS builder

WORKDIR /app

# Arguments for build-time environment variables
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
RUN npm ci

COPY public/ ./public/
COPY src/ ./src/

# Produce optimized production bundle in /app/dist
RUN npm run build

# --- Stage 2: Minimal Web Server ---
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
