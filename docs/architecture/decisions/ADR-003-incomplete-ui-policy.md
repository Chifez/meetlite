# ADR-003: Truthful Product Surfaces & Incomplete UI Policy

- **Status**: **Accepted** (`GOV-05`)
- **Date**: 2026-10-25
- **Deciders**: MeetLite Core Engineering Team
- **Target Milestones**: Phase P0, Phase P6 (`UI-TRUTH-01`, `ADMIN-01`)
- **Governing Standard**: [MeetLite Agent Execution Plan](../meetlite-agent-execution-plan.md)

---

## 1. Context and Problem Statement

An audit of the client application revealed several deceptive and incomplete UI surfaces:
1. **Placeholder Routes**: Routes such as Analytics and Organization Hub rendered generic `ComingSoon` placeholders despite appearing as active items in the main dashboard navigation.
2. **Fabricated Admin Data**: The system admin overview and server health views displayed static, hard-coded percentages and uptime graphs rather than real measurements from backend health probes.
3. **Dead Action Buttons**: Buttons for account deletion, recording export formats, and team permission presets presented success toasts without triggering authoritative backend operations.

Presenting non-functional or simulated capabilities as real features destroys user trust and leads automated verifiers into recording false-positive passes.

---

## 2. Policy Invariants

### 2.1 The Two-State Rule for Visible Controls
Every user-facing action, navigation link, or modal button in MeetLite must strictly satisfy one of two rules:
1. **Fully Implemented**: The button connects to an authorized, tested backend endpoint with persistent database/storage mutations, error handling, and audit logging.
2. **Explicitly Hidden or Disabled Preview**: If the backend implementation is incomplete, the UI control **MUST NOT** pretend to succeed. It must either:
   - Be completely hidden from production navigation; OR
   - Be visually styled as disabled with a clear "Feature in Development" tooltip explaining prerequisites.

### 2.2 Removal of Placeholder Views
- Generic `ComingSoon` screens that hijack navigation routes are prohibited.
- Unimplemented routes must be removed from the router and sidebar until their owning phase is completed.

### 2.3 Measured Truth in System Administration
- The system admin panel (`/admin/system`) must display only authoritative data returned by `/health/live`, `/health/ready`, and Prometheus metrics endpoints.
- If a specific metric or dependency probe is not registered, the UI must render `Unmonitored` rather than a fictitious 99.9% uptime or mock CPU percentage.

---

## 3. Consequences & Rollback

- **Positive**: Eliminates misleading user experiences; ensures that all automated E2E tests validate real system behavior.
- **Negative**: Temporarily reduces the visible surface area of the application until backends for advanced analytics are built in Phase P6.
- **Rollback**: Any UI element hidden in error can be restored once its corresponding API endpoint passes integration contract verification.
