# Cloudflare Tunnel Staging Ingress & Dual-Ingress Operating Standard

This directory contains the Cloudflare Tunnel (`cloudflared`) configuration for MeetLite's staging ingress.

## 1. Architectural Role & Dual-Ingress Invariant

In accordance with Phase 1 / Ticket `S1-04`:
- **Staging Cloudflare Tunnel**: Provides an encrypted, edge-authenticated tunnel connecting Cloudflare's global network to the internal containerized API Gateway without exposing public inbound firewall ports.
- **Dual-Ingress Invariant**: Direct origin ingress (port 3000 for `api-gateway`, port 5002 for `auth-service`, and port 5003 for `room-service`) **MUST remain fully operational** as an immediate, zero-downtime rollback mechanism until Phase S4.

### Ingress Topology

```text
[Internet / Clients]
        │
        ├──> (Edge Route) ──> [Cloudflare Edge / Tunnel] ──> [cloudflared daemon] ──> [api-gateway:3000]
        │
        └──> (Direct Rollback Route) ───────────────────────────────────────────────> [api-gateway:3000]
```

## 2. Ingress Route Manifest

| Hostname | Target Service | Purpose | Protocol |
| :--- | :--- | :--- | :--- |
| `api-staging.meetlite.dev` | `http://api-gateway:3000` | REST API Gateway / Control Plane | HTTP/1.1 |
| `rtc-staging.meetlite.dev` | `http://api-gateway:3000` | Realtime signalling / WebSockets | HTTP/1.1 Upgrade |
| `room-staging.meetlite.dev` | `http://room-service:5001` | Direct room-service diagnostics | HTTP/1.1 |
| `*` (Catch-All) | `http_status:404` | Unmapped host rejection | HTTP 404 |

## 3. Running with Docker Compose

The `cloudflared` service is configured with the `tunnel` profile.

### Start with Tunnel Ingress
```bash
# Provide the tunnel token from your Cloudflare Zero Trust dashboard:
CLOUDFLARE_TUNNEL_TOKEN=ey... docker compose --profile tunnel up -d
```

### Run Direct Ingress Only (Default / Rollback)
```bash
# Standard direct ingress without tunnel:
docker compose up -d
```

## 4. Rollback Procedure

If Cloudflare Tunnel degrades or experiences edge connectivity failure:
1. Update DNS / load balancer records to point directly to origin ingress (`http://<origin-ip>:3000`).
2. API Gateway already listens on `0.0.0.0:3000` and validates all incoming requests identically, requiring zero code changes or container restarts.
3. Once the tunnel incident resolves, re-enable the Cloudflare proxy DNS records.

## 5. Security & Secret Management

- `credentials.json` and `CLOUDFLARE_TUNNEL_TOKEN` must **never** be checked into version control.
- Use environment variables (`CLOUDFLARE_TUNNEL_TOKEN`) or Docker secrets in production.
