# ==========================================
# Client Dockerfile (Multi-stage build)
# ==========================================

# --- Stage 1: Build static assets ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Build-time environment arguments (baked into client JS)
ARG VITE_API_GATEWAY_URL=http://localhost:3000
ARG VITE_MEDIASOUP_SERVER_URL=http://localhost:3003
ARG VITE_BASE_URL=http://localhost:5174

ENV VITE_API_GATEWAY_URL=$VITE_API_GATEWAY_URL
ENV VITE_MEDIASOUP_SERVER_URL=$VITE_MEDIASOUP_SERVER_URL
ENV VITE_BASE_URL=$VITE_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx vite build

# --- Stage 2: Serve via Nginx ---
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
