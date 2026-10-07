# ==========================================
# Room Service Dockerfile
# Build context: ./backend
# ==========================================

# --- Stage 1: Build & Prisma Generation ---
FROM node:20-bookworm-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY packages/room-service/package*.json ./packages/room-service/
COPY packages/room-service/tsconfig.json ./packages/room-service/

RUN npm ci --workspace=@minimeet/shared --workspace=@minimeet/room-service

WORKDIR /app/packages/shared
RUN npx prisma generate

WORKDIR /app
COPY packages/shared/src ./packages/shared/src
COPY packages/room-service/src ./packages/room-service/src

RUN npm run build --workspace=@minimeet/shared --workspace=@minimeet/room-service

# --- Stage 2: Production Runner ---
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY packages/room-service/package*.json ./packages/room-service/

RUN npm ci --omit=dev --workspace=@minimeet/shared --workspace=@minimeet/room-service

WORKDIR /app/packages/shared
RUN npx prisma generate

WORKDIR /app
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/room-service/dist ./packages/room-service/dist

WORKDIR /app/packages/room-service
EXPOSE 5001

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:5001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
