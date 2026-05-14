# Docketra Data Residency Policy (Control Plane Only)

## Policy Statement
Docketra is a **control plane only** platform. Firm business and operational content must be stored in firm-owned cloud storage (BYOS-first, Google Drive preferred). MongoDB is restricted to minimum metadata required for identity, auth, routing, permissions, storage configuration, and technical operations.

## Allowed Data in MongoDB
1. Workspace/control metadata (firm/workspace IDs, slug, display name, status, billing/plan flags, timestamps).
2. Auth/team identity metadata (user IDs, xID, email, role, firm/workspace ID, session/auth state, OTP/password/security metadata).
3. Storage connection metadata (provider, mode, status, encrypted refresh token or secure credential reference, routing metadata).
4. Technical control-plane metadata (audit logs, request IDs, feature flags, migration markers, counters, external references).

## Prohibited Data in MongoDB
MongoDB must not be canonical storage for:
- Client business/profile data (e.g., businessAddress, PAN/TAN/GST/CIN, contact-person fields, fact sheet content).
- Firm operational content and internal business notes.
- Team operational notes/discussions/work allocation content beyond access metadata.
- Docket/task/comment/body content.
- File/document payloads (raw bytes, parsed text, generated ZIP/export payloads).

## Canonical Data Location
Firm cloud storage (Google Drive BYOS preferred) is canonical for:
- Client profiles and CFS JSON.
- Docket/task/comment operational content.
- Attachments/documents and derived outputs.
- Operational notes and workflow artifacts.

MongoDB may store only external object references and minimal lookup metadata.

## Exception Process
Any exception must:
1. Be documented in PR with justification, data-classification tag, retention scope, and rollback plan.
2. Include explicit time-bound allowlist entry in `tests/dataResidency.mongoSchemaGuard.test.js`.
3. Be approved by engineering owner + security/data owner.
4. Include follow-up issue and removal due date.

## Test Requirements for New Features
- Add/update automated tests proving prohibited business fields are not introduced in Mongo schemas.
- Verify cloud-first write path for business/operational data when feature stores business content.
- Add regression checks for reference-only Mongo persistence (ID/objectKey/provider metadata only).

## Code Review Checklist
- [ ] Does this PR add or expand Mongo fields that hold business/operational content?
- [ ] If yes, was design changed to firm-cloud canonical storage?
- [ ] Are Mongo writes limited to IDs, auth, routing, and control-plane metadata?
- [ ] Are encrypted credentials/tokens handled safely with no plaintext logging?
- [ ] Are tests updated (`dataResidency.mongoSchemaGuard.test.js`) and passing?
- [ ] Are temporary exceptions explicitly allowlisted with documented removal plan?

## Enforcement
This policy is enforced through:
- Schema guardrail tests.
- Architecture review in PRs affecting models/repositories/services.
- Periodic audits recorded in `docs/audits/`.

## Client control-plane enforcement update (2026-05-14)
Client business/profile fields are no longer canonical in MongoDB. Client documents must only store control-plane metadata and cloud profile references (`profileRef`).
