# ADR-005: Brand Identity & Trademark Clearance Strategy

- **Status**: **Accepted** (`BRAND-01`)
- **Date**: 2026-10-25
- **Deciders**: MeetLite Executive & Legal Committee
- **Target Milestones**: Phase P0 through Launch
- **Governing Standard**: [MeetLite Agent Execution Plan](../meetlite-agent-execution-plan.md), [Name Trademark Risk Research](../../research/meetlite-name-trademark-risk-2026-10-25.md)

---

## 1. Context and Problem Statement

Research conducted on October 25, 2026 (`docs/research/meetlite-name-trademark-risk-2026-10-25.md`) evaluated the trademark viability and defensibility of the mark **`MeetLite`**.

Key Findings:
1. **Descriptive & Crowded Field**: The term `MeetLite` exhibits high crowdedness in Class 9 (software) and Class 38 (telecommunications), with numerous existing registrations containing "Meet", "Lite", and similar affixes.
2. **Low Ownability**: Defensibility against third-party competitors is weak, and acquiring clean top-level domain assets and trademark exclusivity carries medium-high risk.
3. **Premature Mass Rename Hazards**: Attempting an opportunistic codebase-wide rename (e.g. to candidate names such as `Korvia`) before formal legal clearance disrupts package scopes (`@minimeet/*`), environment variables, Docker image tags, database seeds, and customer URLs.

---

## 2. Decision & Operational Invariants

### 2.1 Codebase Name Preservation
- The repository, package namespaces (`@minimeet/*`), Docker container names, and current UI strings will strictly retain the **`MeetLite`** name throughout development and internal testing.
- Autonomous coding agents are strictly forbidden from performing automated find-and-replace renames of the product name.

### 2.2 Counsel-Led Clearance Prerequisite
- Any future name change must be preceded by formal trademark availability opinion from legal counsel in primary operating jurisdictions (US, EU, UK).
- Candidate names (e.g., `Korvia`, `VeloMeet`, `Syncline`) remain strictly research artifacts until written clearance is executed.

### 2.3 Single-Point Branding Seam
- To prepare for seamless rebranding once counsel clearance is achieved, UI brand strings, application titles, logo assets, and email sender headers must reference centralized configuration constants (`src/config/branding.ts` or similar), avoiding hard-coded strings scattered across disparate components.

---

## 3. Consequences & Rollback

- **Positive**: Prevents breaking changes in container namespaces, package lockfiles, and environment variables; eliminates risk of adopting an uncleared name.
- **Negative**: Requires a dedicated, planned rebranding ticket prior to public marketing launch.
- **Rollback**: Brand name remains `MeetLite` by default across all active branches.
