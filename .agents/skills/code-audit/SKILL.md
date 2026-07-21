---
name: security-audit
description: Static security review of a Node/Express + React codebase — authentication, authorization/access control on routes-pages-view modes (BOLA/IDOR, BFLA, horizontal and vertical privilege escalation), payment/subscription gating and entitlement checks, mass assignment and excessive data exposure (BOP), multi-tenant data isolation, real-time/collaborative app access control (WebRTC rooms, socket-based editing), and general OWASP-style issues (injection, XSS, SSRF, CSRF, secrets, insecure headers). Use when the user asks for a security audit, vulnerability check, auth review, paywall/billing bypass review, or to check for unauthorized access on routes/pages/admin views/tenants/rooms/projects. This is a read-only code review skill that never generates exploits, live-tests running systems, or crafts attack payloads — it reads source and flags missing or misconfigured checks.
---

# Security Audit (Auth, Access Control, Payment Gating, Multi-Tenant & Real-Time + OWASP)

Static, read-only review of your own source code for missing or broken security controls. Same two-phase discipline as any refactor skill: **flag and explain first, fix only what's approved.**

## Hard boundaries (do not cross these)

This skill is a **code reviewer**, not a penetration tester:
- Read and reason about source code only. Never send requests to a running server, staging, or production instance to "test" whether a vuln is exploitable.
- Never write exploit code, proof-of-concept payloads, injection strings, or scripts designed to demonstrate a vulnerability against a live target.
- Never scan or probe infrastructure you don't have explicit code-level access to in this workspace.
- If a finding would benefit from confirming exploitability, say so and stop — recommend the user use a proper authorized pentest process instead. Do not offer to "verify it works."
- Secrets found in code get flagged by location and type only — never echo the actual secret value back in full (mask it, e.g. `sk_live_***...9f2`).

If any of this ever seems like it's blocking legitimate work, that's a sign to slow down and check with the user rather than route around it.

## Phase 1: Locate

```bash
# Route/endpoint definitions
grep -rn "router\.\(get\|post\|put\|delete\|patch\)\|app\.\(get\|post\|put\|delete\|patch\)" --include="*.{js,ts}" <path>

# Auth/middleware usage
grep -rn "authenticate\|requireAuth\|isLoggedIn\|passport\.\|verifyToken\|jwt\.verify" --include="*.{js,ts}" <path>

# Frontend route guards
grep -rn "ProtectedRoute\|PrivateRoute\|useAuth\|role ===\|isAdmin" --include="*.{jsx,tsx}" <path>

# Likely secrets
grep -rnE "(api[_-]?key|secret|password|token)\s*=\s*['\"][A-Za-z0-9]{16,}" --include="*.{js,ts,jsx,tsx,env*}" <path>

# Payment / entitlement gating
grep -rn "stripe\|subscription\|plan\|tier\|entitlement\|isPremium\|isPro\|hasAccess\|webhook" --include="*.{js,ts,jsx,tsx}" <path>

# Multi-tenant scoping
grep -rn "tenantId\|orgId\|workspaceId\|accountId" --include="*.{js,ts}" <path>

# Real-time / room / session access (video conferencing, collaborative editing)
grep -rn "socket\.on\|joinRoom\|io\.to\|roomId\|peerConnection\|broadcast" --include="*.{js,ts,jsx,tsx}" <path>

# Outbound requests built from user input (SSRF surface)
grep -rn "fetch(req\.\|axios\.\(get\|post\)(req\.\|request(req\." --include="*.{js,ts}" <path>
```

Read each matched file in full context — a route handler is meaningless without seeing its middleware chain, and a socket event handler is meaningless without seeing what's checked before it acts.

## Phase 2: Classify

### A. Authentication

| Check | Look for |
|---|---|
| Missing auth on sensitive routes | Route handlers touching user data, admin actions, or mutations with no auth middleware in the chain |
| Weak session/token handling | JWTs verified with `decode()` instead of `verify()`; no expiry check; secret pulled from a hardcoded string instead of env |
| Insecure cookies | Session cookies missing `httpOnly`, `secure`, or `sameSite` flags |
| Password handling | Plaintext storage/comparison instead of bcrypt/argon2; missing rate limiting on login |

```js
// 🚩 Flag — no auth middleware, mutates user data
router.post('/api/users/:id/role', (req, res) => { ... })

// ✅ Fixed
router.post('/api/users/:id/role', requireAuth, requireRole('admin'), (req, res) => { ... })
```

### B. Authorization / Access control (the core of what you asked about)

Frame every finding here as **horizontal** or **vertical** privilege escalation — it's the clearest way to describe severity and impact in the report:
- **Horizontal** = accessing/modifying another user's data at the same permission level (BOLA/IDOR).
- **Vertical** = gaining a higher permission level than granted (BFLA, role/tier escalation).

| Check | Look for |
|---|---|
| Broken Object Level Authorization (BOLA/IDOR) — horizontal | Route uses `req.params.id` to fetch/mutate a resource without checking it belongs to `req.user` |
| Broken Function Level Authorization (BFLA) — vertical | The endpoint itself is admin/privileged-only in intent (e.g. `/admin/delete-user`, `/api/refund`, `/api/users/:id/role`), but any authenticated user — not just admins — can reach it. Distinct from BOLA: the attacker isn't after someone else's *data*, they're calling a *function* they shouldn't have access to at all |
| Missing role/permission checks | Auth middleware confirms *logged in* but handler never checks *allowed to do this specific thing* |
| Client-side-only protection | React route guard (`<ProtectedRoute>`, conditional render on `isAdmin`) with no matching backend enforcement — the real vulnerability is always the missing backend check, the UI guard is cosmetic |
| View-mode / feature-flag as security | Hiding an admin panel or view behind a client state flag instead of a real permission check — flag explicitly, this is a common pattern in dashboards |
| Mass assignment (a.k.a. object injection) | Handler does `User.update(req.body)` unfiltered, letting a client set fields like `role` or `isAdmin` directly — the field doesn't even need to be in the form, just guessable in the payload |
| Excessive data exposure | API returns the full internal object (e.g. whole `User` row including password hash, internal flags, other users' emails in a list response) and relies on the frontend to only *display* the safe fields — the full object already left the server |

Mass assignment + excessive data exposure together are sometimes grouped as **Broken Object Properties (BOP)** in newer API security taxonomies — same underlying fix either way: an explicit allowlist of fields, both on write (what the client can set) and on read (what the server sends back).

```js
// 🚩 Flag — BFLA: any logged-in user can hit an admin-only function
router.post('/admin/delete-user', requireAuth, (req, res) => { ... })

// ✅ Fixed
router.post('/admin/delete-user', requireAuth, requireRole('admin'), (req, res) => { ... })
```

```js
// 🚩 Flag — excessive data exposure: full user object serialized, including password hash
router.get('/api/users/:id', requireAuth, async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user); // sends everything
});

// ✅ Fixed — explicit response shape
res.json({ id: user.id, name: user.name, email: user.email });
```

```jsx
// 🚩 Flag — frontend hides the button, but is the DELETE route itself protected?
{isAdmin && <button onClick={() => deleteUser(id)}>Delete</button>}

// Check the corresponding backend route — THIS is where the real fix goes:
// 🚩 router.delete('/api/users/:id', requireAuth, (req, res) => {...})  — no role check
// ✅ router.delete('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {...})
```

Always trace a frontend guard down to its backend route before concluding anything. A frontend-only finding is incomplete — report both halves.

### C. OWASP-style checks

| Category | Look for |
|---|---|
| Injection | Raw string concatenation into SQL/Mongo queries instead of parameterized queries/ORM methods; `eval`/`Function()` on user input |
| XSS | `dangerouslySetInnerHTML` with unsanitized data; raw `innerHTML` assignment; unescaped user content rendered server-side |
| CSRF | State-changing routes with no CSRF token check when using cookie-based sessions (less relevant if purely token-in-header auth) |
| SSRF (Server-Side Request Forgery) | Server code makes an outbound HTTP request to a URL/host taken from user input (e.g. "fetch this webhook/avatar/link preview URL") without an allowlist — can be abused to reach internal services, `localhost`, or cloud metadata endpoints (`169.254.169.254`) that aren't meant to be reachable externally. Often chained with IDOR-style parameters, so check any route that accepts a URL, hostname, or "callback" field |
| Secrets in source | API keys, DB URLs, JWT secrets committed directly instead of read from `process.env` |
| Insecure headers | Missing `helmet()` or equivalent; no CSP; `Access-Control-Allow-Origin: *` on routes that require credentials |
| Open redirect | Redirect target taken directly from a query param without an allowlist |
| Rate limiting | Auth/password-reset/OTP endpoints with no rate limiter |
| Dependency risk | Flag that `npm audit` should be run; don't attempt to enumerate CVEs from memory since that data goes stale |

```js
// 🚩 Flag — SSRF: server fetches whatever URL the client provides
router.post('/api/link-preview', requireAuth, async (req, res) => {
  const html = await fetch(req.body.url).then(r => r.text()); // could target internal services
  res.send(extractPreview(html));
});

// ✅ Fixed — allowlist scheme/host, block internal/metadata ranges
router.post('/api/link-preview', requireAuth, async (req, res) => {
  const url = new URL(req.body.url);
  if (!ALLOWED_HOSTS.has(url.hostname) || isPrivateOrMetadataAddress(url.hostname)) {
    return res.status(400).end();
  }
  const html = await fetch(url).then(r => r.text());
  res.send(extractPreview(html));
});
```



### D. Payment / subscription / entitlement gating

The general principle: **any check that decides "can this account do/see/export X" must be enforced on the server, at the point of the action** — not just at the point of purchase, and not in the client.

| Check | Look for |
|---|---|
| Client-side-only feature gating | React checks `user.plan === 'pro'` to show/hide a feature, but the API route or socket handler that performs the action doesn't independently check plan/entitlement |
| Trusting client-supplied plan/price data | Checkout or order route accepts `price`, `planId`, or `amount` from the request body instead of looking it up server-side from a trusted source |
| Webhook signature not verified | Stripe/payment-provider webhook handler processes events without verifying the signature header — lets anyone POST a fake "payment succeeded" event |
| Missing idempotency on payment webhooks | Webhook handler can be replayed to double-credit an account (e.g. re-grant premium, re-add seats) |
| Tier escalation via user-editable field | Plan/role stored on a record the user's own update route can touch (ties back to mass assignment in section B) |
| Trial/quota logic enforced client-side only | "3 free exports" or similar counted in local/component state rather than checked server-side before the export/render action runs |
| Coupon/discount abuse | Discount code validated only on the frontend, or backend doesn't check usage limits/expiry server-side |

```js
// 🚩 Flag — plan comes from the client, not looked up
app.post('/api/checkout', (req, res) => {
  const { planId, price } = req.body; // client controls the price
  charge(price);
});

// ✅ Fixed — server is the source of truth for price
app.post('/api/checkout', requireAuth, (req, res) => {
  const plan = PLANS[req.body.planId]; // looked up server-side
  charge(plan.price);
});
```

```js
// 🚩 Flag — no signature check, anyone can POST a fake event
app.post('/webhook/stripe', (req, res) => {
  if (req.body.type === 'checkout.session.completed') grantPremium(req.body.customerId);
});

// ✅ Fixed
app.post('/webhook/stripe', (req, res) => {
  const event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], WEBHOOK_SECRET);
  if (event.type === 'checkout.session.completed') grantPremium(event.data.object.customer);
});
```

Same trace-down discipline as section B: a "🔒 Pro feature" badge or disabled button in the UI is not a finding by itself — the finding (if any) is whether the underlying route/action is independently gated.

### E. Multi-tenant data isolation

Relevant for dashboard/LMS-style apps with orgs, workspaces, or accounts (e.g. a Bellcurves-style multi-tenant setup).

| Check | Look for |
|---|---|
| Missing tenant scope in queries | A query fetches by `id` alone without also filtering by `tenantId`/`orgId` matching the authenticated user's tenant — lets one tenant read/edit another's data by guessing/incrementing an id |
| Tenant id trusted from the client | Request body or query string supplies `tenantId` directly instead of deriving it from the authenticated session |
| Shared resource pools without tenant checks | Background jobs, caches, or file storage keyed only by a resource id, not namespaced by tenant |
| Cross-tenant admin/impersonation paths | "Support/impersonate user" features that don't log or scope which tenant an admin is acting within |

```js
// 🚩 Flag — any authenticated user can read any course by id, regardless of org
router.get('/api/courses/:id', requireAuth, async (req, res) => {
  const course = await Course.findById(req.params.id);
  res.json(course);
});

// ✅ Fixed — scoped to the caller's tenant
router.get('/api/courses/:id', requireAuth, async (req, res) => {
  const course = await Course.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!course) return res.status(404).end();
  res.json(course);
});
```

### F. Real-time & collaborative app access control

Relevant for WebRTC video conferencing (MeetLite-style) and collaborative design/canvas tools (MotionSlides-style) — auth checks often live at the HTTP layer but get skipped for sockets/signaling.

| Check | Look for |
|---|---|
| Room/session join with no membership check | `joinRoom(roomId)` accepts any connected socket without verifying the user was invited/is a participant — a guessable or leaked room id becomes an open door |
| Signaling server trusts client-asserted identity | Socket handlers use a `userId`/`displayName` sent in the message payload instead of the value from the authenticated connection/session |
| Role elevation via client message | A participant can send a message claiming `role: 'host'` (e.g. to mute others, end the call, kick a participant) and the server acts on it without checking their actual assigned role |
| Recording/export access | Recording start/stop or export-to-file actions not restricted to the room owner/host role |
| Predictable/sequential share links | Project or room share URLs use incrementing ids instead of unguessable tokens, enabling enumeration |
| Collaborative edit permission bypass | Any connected socket in a shared canvas/document can send edit events regardless of whether they were granted view-only vs edit access |
| TURN/STUN credential exposure | Long-lived or static TURN credentials shipped to the client instead of short-lived, per-session generated credentials |

```js
// 🚩 Flag — server trusts the role the client claims
socket.on('mute-participant', ({ role, targetId }) => {
  if (role === 'host') muteUser(targetId); // role is attacker-controlled
});

// ✅ Fixed — server looks up the caller's actual role from the room state
socket.on('mute-participant', ({ targetId }) => {
  const caller = getParticipant(currentRoom, socket.userId); // socket.userId set at auth time, not from payload
  if (caller.role === 'host') muteUser(targetId);
});
```

### ✅ Not a finding
Auth/role checks present and correctly ordered in the middleware chain; parameterized queries; env-sourced secrets; backend-enforced access control even if the frontend UI also happens to hide the option; server-derived tenant/room/role scoping; webhook signature verification present; server-side price/plan lookups. Report these as reviewed-OK, don't manufacture findings to seem thorough.

## Phase 3: Report

Group by file, one line per finding, severity-tagged:

```
src/routes/users.js
  L34  🔴 HIGH   Authorization (BFLA, vertical) — DELETE /api/users/:id has requireAuth but no requireRole; any logged-in user can delete any account
  L51  🟡 MEDIUM — role field included in unfiltered req.body update (mass assignment)
  L12  ✅ Reviewed — login route has rate limiting and bcrypt comparison, OK

src/components/AdminPanel.tsx
  L9   🔴 HIGH   Authorization — panel rendering gated on client isAdmin only; confirm backend routes it calls are independently protected (see users.js L34)

src/routes/checkout.js
  L18  🔴 HIGH   Payment gating — price taken from req.body instead of server-side plan lookup
  L40  🔴 HIGH   Payment gating — Stripe webhook has no signature verification

src/sockets/room.js
  L22  🔴 HIGH   Real-time access — mute-participant handler trusts role from client payload, not server-assigned role

src/routes/link-preview.js
  L15  🔴 HIGH   SSRF — link preview route fetches an unvalidated client-supplied URL
```

Severity guide: 🔴 HIGH = missing/bypassable access control or exposed secret. 🟡 MEDIUM = defense-in-depth gap (missing rate limit, weak header config). 🟢 LOW = hardening suggestion, not an active gap.

Stop here. Ask which findings (all/some/none) to fix.

## Phase 4: Fix

Only for approved findings:
1. Apply the minimal correct fix (add the missing middleware, parameterize the query, move the secret to env, add the header).
2. Show before/after diff.
3. If a fix needs a new package (e.g. `helmet`, `express-rate-limit`), check `package.json` first and flag the addition rather than assuming it's wanted.
4. Never invent an auth/permission system from scratch if one already exists partially — extend the existing pattern (e.g. if `requireRole` exists elsewhere, reuse it, don't create a parallel one).