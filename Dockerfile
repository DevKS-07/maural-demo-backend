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
RUN npx prisma generate

# ---- Production Stage ----
FROM node:22-alpine

# Runtime libraries needed by native modules (bcrypt, canvas)
RUN apk add --no-cache cairo pango libjpeg-turbo giflib

# Don't run as root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy node_modules from build stage (includes compiled native modules + generated Prisma client)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json* ./

# Prune dev dependencies (generated .prisma files are not npm packages, so they survive)
RUN npm prune --omit=dev

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
