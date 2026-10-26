# UI-TRUTH-01: Route Inventory and Preview Boundaries

- Phase / track: Phase P6 — Dashboard, Admin, Account, and Billing Completeness
- Invariant: Every client route, action button, and navigation menu either maps to an authoritative working backend capability, or is explicitly wrapped in the honest `<ComingSoon />` preview boundary rather than broken or fake functionality.
- Scope: `client/src/App.tsx`, `client/src/components/ui/coming-soon.tsx`, `client/src/components/protected-route.tsx`.
- Forbidden scope: No "Coming Soon" label on features that are claimed to be active; no unhandled 404s or uncaught promises in route transitions.
- Dependencies: Phase P1 verifier, Phase P2 critical browser flows.
- Risk classification: low
- Rollback / kill switch: Revert route definitions in `client/src/App.tsx`.
- Baseline commit and environment: Commit `d165212`, Node `v24.21.0`, Vite 5.4.
- Pre-existing failures: Previous versions of the frontend had broken stub routes that crashed on navigation.

## Route Inventory & Truth Matrix

| Route Path | Type | Component | Status / Backing Service |
| :--- | :--- | :--- | :--- |
| `/login` | Public | `<Login />` | Active: `auth-service` `/api/auth/login` |
| `/signup` | Public | `<Signup />` | Active: `auth-service` `/api/auth/signup` |
| `/forgot-password` | Public | `<ForgotPassword />` | Active: `auth-service` `/api/auth/forgot-password` |
| `/reset-password` | Public | `<ResetPassword />` | Active: `auth-service` `/api/auth/reset-password` |
| `/meeting/:meetingId/join` | Public | `<MeetingJoin />` | Active: `room-service` join verification |
| `/invite/:token` | Public | `<InvitationPage />` | Active: `auth-service` invitation acceptance |
| `/payment/success` | Public | `<PaymentSuccess />` | Active: `auth-service` checkout completion |
| `/onboarding` | Protected | `<Onboarding />` | Active: `auth-service` onboarding profile flow |
| `/dashboard` | Protected | `<Dashboard />` | Active: `room-service` & `auth-service` user dashboard |
| `/lobby/:roomId` | Protected | `<Lobby />` | Active: `room-service` device test and preflight |
| `/room/:roomId` | Protected | `<Room />` | Active: Mediasoup SFU & Edge Room Coordinator |
| `/meetings` | Protected | `<Meetings />` | Active: `room-service` meeting management |
| `/members` | Protected | `<Members />` | Active: `auth-service` organization member management |
| `/recordings` | Protected | `<Recordings />` | Active: `room-service` R2 recordings management |
| `/settings/:tab?` | Protected | `<Settings />` | Active: User settings, profile, calendar integrations |
| `/notifications` | Protected | `<Notifications />` | Active: Push and user notifications |
| `/analytics` | Protected | `<ComingSoon />` | **Preview Boundary**: Labeled "Advanced meeting analytics" |
| `/organization` | Protected | `<ComingSoon />` | **Preview Boundary**: Labeled "New organization hub" |
| `/admin` | Admin Protected | `<AdminOverview />` | Active: System admin dashboard |
| `/admin/manage` | Admin Protected | `<AdminManage />` | Active: User and meeting administration |
| `/admin/inquiries` | Admin Protected | `<AdminInquiries />` | Active: Enterprise inquiry management |
| `/admin/revenue` | Admin Protected | `<AdminRevenue />` | Active: Revenue and subscription reporting |
| `/admin/system` | Admin Protected | `<AdminSystem />` | Active: Real measured health & system audit logs |
| `*` | Fallback | `<NotFound />` | Active: 404 handler |

All routes conform to the strict truth boundary: zero broken routes and zero fake capabilities presented as finished.
