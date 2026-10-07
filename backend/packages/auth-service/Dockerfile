# ==========================================
# Auth Service Dockerfile
# Build context: ./backend
# ==========================================

# --- Stage 1: Build & Prisma Generation ---
FROM node:20-bookworm-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy package manifests for workspace resolution
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY packages/auth-service/package*.json ./packages/auth-service/
COPY packages/auth-service/tsconfig.json ./packages/auth-service/

# Install workspace dependencies
RUN npm ci --workspace=@minimeet/shared --workspace=@minimeet/auth-service

# Generate Prisma Client
WORKDIR /app/packages/shared
RUN npx prisma generate

# Copy source code
WORKDIR /app
COPY packages/shared/src ./packages/shared/src
COPY packages/auth-service/src ./packages/auth-service/src

# Compile TypeScript
RUN npm run build --workspace=@minimeet/shared --workspace=@minimeet/auth-service

# --- Stage 2: Production Runner ---
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY packages/auth-service/package*.json ./packages/auth-service/

RUN npm ci --omit=dev --workspace=@minimeet/shared --workspace=@minimeet/auth-service

WORKDIR /app/packages/shared
RUN npx prisma generate

WORKDIR /app
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/auth-service/dist ./packages/auth-service/dist

WORKDIR /app/packages/auth-service
EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
