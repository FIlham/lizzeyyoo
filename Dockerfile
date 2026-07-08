# ============================================================
# Stage 1: Builder — install deps + build production bundle
# ============================================================
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json bun.lock ./

# Install ALL deps (including devDeps needed for build)
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build production bundle (vinxi/tanstack-start)
# Outputs to dist/ directory
RUN bun --bun run build

# ============================================================
# Stage 2: Runner — minimal image, only runtime deps
# ============================================================
FROM oven/bun:1.3-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy Drizzle migrations and programmatic migration runner
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/server/migrate.ts ./src/server/migrate.ts

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

# Start the production server
CMD ["bun", "--bun", "run", "dist/server/server.js"]
