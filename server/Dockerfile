# ==============================================================================
# PULSE BACKEND SERVICE — PRODUCTION DOCKERFILE
# Multi-stage, minimal attack-surface Node 20 Alpine container
# ==============================================================================

# --- Stage 1: Build & Typecheck ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy server source code
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV PULSE_STORAGE_MODE=cloud

# Install dumb-init for proper signal forwarding and PID 1 zombie handling
RUN apk add --no-cache dumb-init curl

# Install production-only runtime dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Prepare runtime data directory with proper ownership for unprivileged node user
RUN mkdir -p /app/data && chown -R node:node /app/data

# Run as non-privileged node user
USER node

EXPOSE 3001

# Continuous container health check against the live health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
