# ==========================================
# MediaSoup Service Dockerfile
# Build context: ./backend
# ==========================================

# --- Stage 1: Build & Native C++ Compilation ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Install native compilation toolchain for mediasoup-worker
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    make \
    g++ \
    gcc \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY packages/mediasoup-service/package*.json ./packages/mediasoup-service/
COPY packages/mediasoup-service/tsconfig.json ./packages/mediasoup-service/

RUN npm ci --workspace=@minimeet/shared --workspace=@minimeet/mediasoup-service

WORKDIR /app/packages/shared
RUN npx prisma generate

WORKDIR /app
COPY packages/shared/src ./packages/shared/src
COPY packages/mediasoup-service/src ./packages/mediasoup-service/src

RUN npm run build --workspace=@minimeet/shared --workspace=@minimeet/mediasoup-service

# --- Stage 2: Production Runner ---
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/mediasoup-service/package*.json ./packages/mediasoup-service/

# Copy compiled node_modules (including native mediasoup-worker binary) from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/prisma ./packages/shared/prisma
COPY --from=builder /app/packages/mediasoup-service/dist ./packages/mediasoup-service/dist

WORKDIR /app/packages/mediasoup-service
RUN mkdir -p uploads

EXPOSE 3003
EXPOSE 10000-10100/udp
EXPOSE 10000-10100/tcp

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3003/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
