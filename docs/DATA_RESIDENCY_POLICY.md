# Docketra Data Residency Policy (Control Plane Only)

## Policy Statement
Docketra is a control-plane-first platform with a cloud-first transition in progress. Canonical new writes are cloud-first for selected domains, with legacy Mongo compatibility retained during transition. MongoDB is restricted to minimum metadata required for identity, auth, routing, permissions, storage configuration, and technical operations.

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

Implementation status as of 2026-05-22:
- Implemented: client profile cloud-first pathways, storage reference-only attachment metadata, strict firm-owned storage mode controls.
- Legacy exceptions remain: docket/task/comment/knowledge narrative content and some client/CFS legacy fields remain in Mongo pending migration phases.
- Planned: phased migration documented in `docs/audits/DATA_RESIDENCY_FULL_AUDIT_2026-05.md`.

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


- Added **Strict firm-owned storage mode** (Primary Admin controlled). When enabled, business-content writes require active firm-owned Google Drive and Docketra-managed fallback is disabled for writes.

- CFS storage status (2026-05-22): canonical CFS content is now cloud-first (`firms/{firmId}/clients/{clientId}/cfs/cfs.json`); Mongo retains only reference metadata and temporary legacy read compatibility.
- Added Docket cloud-first narrative storage: canonical docket JSON at firms/{firmId}/dockets/{docketId}/docket.json with Mongo retaining control metadata + docketRef/docketStorageMode, legacy Mongo read fallback when no docketRef, and safe warning docket_content_unavailable on cloud-read failure.

- Added Task cloud-first narrative policy: task business narrative is persisted in BYOS/managed cloud JSON (`firms/{firmId}/tasks/{taskId}/task.json`) with `taskRef` metadata in Mongo; transition phase keeps legacy description compatibility until runtime write removal.

- Comments/history are now cloud-first canonical narratives using `commentRef`/`historyRef` pointers; Mongo text fields remain transitional compatibility fields until hard cutover.


## Current cloud-first transition status (2026-05-24)

| Area | Cloud-first canonical write | Cloud read hydration | Mongo legacy fields retained | Strict mode enforced | Next action |
|---|---|---|---|---|---|
| Client profile | Yes | Yes | Yes (transitional compatibility) | Yes | Complete runtime write-removal of legacy business fields. |
| CFS | Yes | Yes | Yes (transitional compatibility) | Yes | Retire remaining legacy compatibility reads after cutover. |
| Docket narrative | Yes | Yes | Yes (legacy fallback when refs absent) | Yes | Backfill refs for older records and remove narrative fallback columns. |
| Task narrative | Yes | Yes | Yes (transitional compatibility) | Yes | Remove legacy description writes after migration completion. |
| Comments/history | Yes | Yes | Yes (transitional compatibility) | Yes | Backfill historical refs and remove legacy text/description dependencies. |
| Attachments | Yes (object/file storage refs) | Yes | Minimal metadata only | Yes | Keep ref-only Mongo posture and continue schema guard enforcement. |
| SOP/checklist/knowledge | Not fully yet | Partial/legacy | Yes | Partial | Implement cloud-first canonical docs and migration tooling. |
| Billing/auth/control-plane | Not applicable (control-plane data) | Not applicable | Required canonical control-plane fields | Not applicable | Maintain metadata-minimal schemas and guardrail tests. |
