# ==========================================
# Edge Room Coordinator Dockerfile
# Build context: ./backend
# ==========================================

# --- Stage 1: Build ---
FROM node:20-bookworm-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY packages/edge-room-coordinator/package*.json ./packages/edge-room-coordinator/
COPY packages/edge-room-coordinator/tsconfig.json ./packages/edge-room-coordinator/

RUN npm ci --workspace=@minimeet/shared --workspace=@minimeet/edge-room-coordinator

WORKDIR /app/packages/shared
RUN npx prisma generate

WORKDIR /app
COPY packages/shared/src ./packages/shared/src
COPY packages/edge-room-coordinator/src ./packages/edge-room-coordinator/src

RUN npm run build --workspace=@minimeet/shared --workspace=@minimeet/edge-room-coordinator

# --- Stage 2: Production Runner ---
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV RUN_STANDALONE=true
ENV PORT=8787

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY packages/edge-room-coordinator/package*.json ./packages/edge-room-coordinator/

RUN npm ci --omit=dev --workspace=@minimeet/shared --workspace=@minimeet/edge-room-coordinator

WORKDIR /app/packages/shared
RUN npx prisma generate

WORKDIR /app
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/edge-room-coordinator/dist ./packages/edge-room-coordinator/dist

WORKDIR /app/packages/edge-room-coordinator
EXPOSE 8787

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8787/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
