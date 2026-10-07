# ==========================================
# API Gateway Dockerfile
# Build context: ./backend
# ==========================================

# --- Stage 1: Build TypeScript ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/api-gateway/package*.json ./packages/api-gateway/
COPY packages/api-gateway/tsconfig.json ./packages/api-gateway/

RUN npm ci --workspace=@minimeet/api-gateway

COPY packages/api-gateway/src ./packages/api-gateway/src
RUN npm run build --workspace=@minimeet/api-gateway

# --- Stage 2: Production Runner ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/api-gateway/package*.json ./packages/api-gateway/

RUN npm ci --omit=dev --workspace=@minimeet/api-gateway

COPY --from=builder /app/packages/api-gateway/dist ./packages/api-gateway/dist

WORKDIR /app/packages/api-gateway
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
