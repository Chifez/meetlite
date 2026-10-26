# ADR-004: Recording & AI Consent, Privacy, and Data Retention Policy

- **Status**: **Accepted** (`GOV-04`)
- **Date**: 2026-10-25
- **Deciders**: MeetLite Core Engineering Team
- **Target Milestones**: Phase P0, Phase P6, Phase P7 (`REC-01`, `RECORD-UI-01`)
- **Governing Standard**: [MeetLite Agent Execution Plan](../meetlite-agent-execution-plan.md)

---

## 1. Context and Problem Statement

Video meeting recordings and AI-generated transcripts contain sensitive corporate, personal, and biometric audio/visual data. Without explicit consent models, tenant data isolation, and lifecycle retention enforcement, storing meeting media in Cloudflare R2 introduces serious compliance and regulatory liability (GDPR, CCPA, wiretapping laws).

---

## 2. Policy Invariants & Technical Guarantees

### 2.1 Multi-Party Explicit Consent
1. **Audio/Visual Notification**: When recording is initiated by an authorized host, all participants receive an immutable signalling event (`recording:started`) triggering an audible notification chime and a persistent, high-contrast visual recording banner.
2. **Right to Opt-Out**: Any participant who refuses consent must be permitted to leave the room or mute their tracks without losing chat or presentation viewing capabilities.
3. **AI Transcription Opt-In**: Automatic speech-to-text processing or LLM summarization is strictly disabled by default. It requires an explicit organization admin toggle (`enableAiSummaries: true`) with clear disclosure of third-party processor data retention terms.

### 2.2 Storage & Tenant Boundary Protection
1. **Tenant-Scoped Object Keys**: All raw media chunks, composite MP4 files, and transcript JSON files are stored in Cloudflare R2 under the strict hierarchical key format:
   ```text
   tenants/{tenantId}/recordings/{recordingId}/composite.mp4
   tenants/{tenantId}/recordings/{recordingId}/transcript.json
   ```
2. **Zero Cross-Tenant Leakage**: Access to recording metadata and playback presigned URLs requires a `VerifiedPrincipal` with membership in the owning `tenantId`. Cross-tenant requests return a generic `404 Not Found` to prevent resource enumeration.
3. **Zero RAM Buffering**: Media streams must be uploaded directly to Cloudflare R2 via presigned S1-02 multipart chunks (5MB–10MB), preventing API Gateway or server RAM exhaustion.

### 2.3 Retention Schedules & Deletion Lifecycles
1. **Configurable Retention Window**:
   - Free Tier: Maximum 14 days storage; automatically purged via S3/R2 lifecycle rules.
   - Pro Tier: 90 days retention with manual export.
   - Enterprise Tier: Custom retention (30–365 days) with legal hold support.
2. **Hard Deletion Primitives**: When an authorized owner deletes a recording, the database record is flagged, presigned playback URLs are immediately invalidated, and the underlying R2 objects and transcripts are hard-deleted within 24 hours.

---

## 3. Consequences & Rollback

- **Positive**: Complies with international wiretap and privacy standards; guarantees multi-tenant isolation at the storage level.
- **Negative**: Adds state machine complexity to the recording controller and requires background reconciliation jobs to ensure clean R2 object purging.
- **Rollback**: If Cloudflare R2 storage policies cause ingestion failures, fall back to legacy server-side disk storage behind the `STORAGE_PROVIDER=local` configuration flag.
