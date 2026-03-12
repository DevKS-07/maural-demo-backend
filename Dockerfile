# ---- Build Stage ----
FROM node:22-alpine AS build

# Native dependencies for bcrypt and @napi-rs/canvas
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install ALL dependencies (need devDeps for prisma generate)
RUN npm ci

# Generate Prisma client
RUN DIRECT_URL=postgresql://build:build@localhost:5432/build npx prisma generate

# ---- Production Stage ----
FROM node:22-alpine

# Runtime libraries needed by native modules (bcrypt, canvas)
RUN apk add --no-cache cairo pango libjpeg-turbo giflib

# Don't run as root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy dependency manifests and install production-only deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# Overwrite @prisma/client with the build stage version (includes generated client)
# Prisma 7 generates into both .prisma/client and @prisma/client — they must match
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy application source
COPY . .

# Switch to non-root user
USER appuser

# Railway injects PORT dynamically; default to 3000
EXPOSE ${PORT:-3000}

# Health check (requires /health endpoint — see checklist step 5)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

CMD ["node", "server.js"]
