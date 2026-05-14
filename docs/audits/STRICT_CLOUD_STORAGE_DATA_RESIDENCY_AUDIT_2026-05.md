# Strict Cloud Storage Data Residency Audit — 2026-05

## Scope & Method
Inspected:
- `src/models/**`
- `src/repositories/**`
- `src/controllers/**`
- `src/services/**`
- `src/mappers/**`
- `src/schemas/**`
- `scripts/**` including `scripts/migrations/**`
- `docs/BYOS_STORAGE_SETUP.md`

This PR contains **audit + policy + guardrails + migration strategy only**.
No destructive migration, no production data deletion, and no runtime data migration execution are included.

## Executive Compliance Result
**Current status: Non-compliant (High/Critical in several models).**

MongoDB currently stores multiple prohibited business/operational fields (notably in `Client`, `Case`, `Task`, `Comment`, and content-bearing models). Control-plane models are largely compliant.

## Model Inventory & Classification

Legend:
- Classification: Allowed / Questionable / Prohibited
- Action: Keep Mongo / Move to Cloud JSON / Move to Cloud File / Mongo ref only

| Model | Stored Fields (representative schema keys) | Classification | Risk | Compliance | Recommended Action | Canonical Cloud Path |
|---|---|---|---|---|---|---|
| `Client.model.js` | `businessName`, `businessAddress`, `businessEmail`, `PAN`, `TAN`, `GST`, `CIN`, contact person fields, `description`, `notes`, `comments`, `clientFactSheet`, storage refs | Prohibited-heavy | **Critical** | Non-compliant | Move business profile + CFS to cloud JSON; keep IDs/status/refs only | `firms/{firmId}/clients/{clientId}/profile.json`, `.../cfs/cfs.json` |
| `Case.model.js` | `title`, `description`, routing, status, lifecycle, embedded client snapshot fields incl. `businessAddress`,`PAN` etc | Prohibited-heavy | **Critical** | Non-compliant | Move docket/task narrative and client business snapshot to cloud JSON; keep lifecycle + refs | `firms/{firmId}/dockets/{docketId}/docket.json` |
| `Task.js` | `title`, `description`, `statusHistory.comment`, assignee/status metadata | Prohibited content mixed with control | High | Non-compliant | Move task content JSON to cloud; keep IDs/status refs | `firms/{firmId}/dockets/{docketId}/tasks/{taskId}.json` |
| `Comment.model.js` | `text`, actor metadata, firm/case refs | Prohibited content | High | Non-compliant | Move comment bodies to cloud JSON; Mongo ref only | `firms/{firmId}/dockets/{docketId}/comments/{commentId}.json` |
| `Attachment.model.js` | metadata + `description`, AI `analysis`, `extractedFields`, file refs | Questionable/prohibited fields | High | Partially non-compliant | Keep metadata, move parsed/derived content to cloud object | `firms/{firmId}/files/{fileId}/metadata.json` + file object |
| `CaseFile.model.js` | file metadata + `description`,`note` | Questionable | Medium | Partially non-compliant | Keep upload/control metadata, move notes/content to cloud JSON | `firms/{firmId}/files/{fileId}/notes.json` |
| `KnowledgeItem.model.js` | `content`, `summary`, `description` + links/owner | Prohibited operational content | High | Non-compliant | Cloud JSON canonical, Mongo references/index aids only | `firms/{firmId}/knowledge/{itemId}.json` |
| `Lead.model.js` | lead profile + `notes`, activity metadata | Questionable/prohibited | High | Non-compliant | Cloud JSON for notes/body; Mongo minimal pipeline metadata | `firms/{firmId}/crm/leads/{leadId}.json` |
| `CrmClient.model.js`, `Deal.model.js`, `Invoice.model.js` | CRM business entities | Prohibited business content | High | Non-compliant | Cloud JSON canonical, Mongo refs/state only | `firms/{firmId}/crm/.../*.json` |
| `LandingPage.model.js`, `Form.model.js`, `ProductUpdate.model.js` | content/config text bodies | Questionable (operational content) | Medium | Needs minimization | Evaluate cloud JSON canonical where business-authored content is stored | `firms/{firmId}/config/forms/{formId}.json` |
| `UserProfile.model.js` | personal profile (`address`, PAN/Aadhaar masked fields) | Prohibited personal/business profile | High | Non-compliant | Move rich profile to cloud JSON, keep auth identity in Mongo | `firms/{firmId}/users/{xID}/profile.json` |
| `Firm.model.js` | firm identity + large settings/config + possible operational settings | Mostly allowed + questionable | Medium | Partially compliant | Keep workspace identity, auth/storage config; move operational narrative/content fields to cloud JSON | `firms/{firmId}/workspace/settings.json` |
| `User.model.js`, `Team.model.js`, `AuthIdentity.model.js`, `Otp.model.js`, `LoginSession.model.js`, `RefreshToken.model.js`, `SignupSession.model.js`, `TemporarySignup.js` | identity/auth/session/role/security metadata | Allowed | Low | Compliant | Keep in Mongo | N/A |
| `StorageConfiguration.model.js`, `TenantStorageConfig.model.js`, `FirmStorage*.model.js`, `TenantStorageHealth.model.js`, `TenantStorageUsage.model.js` | provider/config/status/token refs | Allowed control-plane | Low | Compliant | Keep in Mongo | N/A |
| `AuditLog` family (`AuditLog`, `AuthAudit`, `ClientAudit`, `CaseAudit`, `DocketAudit*`, `SettingsAuditLog`, `AdminAuditLog`, `SuperadminAudit`, `AiAuditLog`, `ReportExportLog`, `OnboardingEvent`) | audit/control metadata | Allowed | Low | Compliant | Keep in Mongo | N/A |
| `Category`, `SubWorkType`, `WorkType`, `SlaRule`, `TenantSlaConfig`, `DocketRoute`, `DocketSession`, `Counter`, `Plan`, `Notification*`, `Outbox`, `UploadSession`, `BulkUploadJob`, `BackupJob`, `Email*`, `File`, `DocketAttachmentMetadata`, `TenantMetrics`, `TenantCaseMetricsDaily`, `FirmSetupTemplate`, `SuperadminPlatformConfig`, `EnterpriseInquiry`, `EarlyAccessRequest`, `Lead` (non-notes), `CaseHistory` | mostly control/routing/system metadata | Allowed/Questionable mix | Low-Medium | Mostly compliant | Keep control metadata, minimize free-text fields | as needed |

## Notes from Repositories/Services/Controllers/Scripts
- `clientProfileStorage.service` and BYOS-related flows already indicate cloud storage pathway; enforce cloud-first for all future business profile writes.
- `clientProfileWriteGuard.service` is relevant for write restriction layering and should be extended in follow-up runtime PR.
- Existing migration scripts under `scripts/migrations/` include data movement tooling; **not executed or modified destructively in this PR**.

## Phased Migration Strategy
### Phase 1 (this PR)
- Audit + policy + schema guardrails only.

### Phase 2 (future)
- Cloud-first writes for new/updated business data:
  - Client profile JSON in firm Google Drive.
  - CFS JSON in firm Google Drive.
  - Task/docket/comment bodies in firm Google Drive.
  - Mongo stores IDs, statuses, and cloud references only.

### Phase 3 (future, test data only)
- Add explicit non-production cleanup script.
- Preserve firms/users/xIDs/emails/roles/auth/storage metadata.
- Remove prohibited test business data from Mongo.
- Require `RUN_DESTRUCTIVE_TEST_DATA_RESET=true`.
- Hard-block production execution unless explicitly redesigned/approved.

### Phase 4 (future, production migration tool)
- Dry-run mode.
- Backup creation.
- Cloud JSON/file writes.
- Checksum/reference verification.
- Mongo reference updates.
- Rollback plan.
- Audit log emission.

## Follow-up PR Backlog
1. Client schema minimization (move prohibited client fields to cloud JSON).
2. Case/task/comment schema minimization with external content references.
3. Knowledge/CRM content externalization.
4. UserProfile sensitive field minimization.
5. Guardrail expansion: runtime write guard in services/repositories.
6. Add CI job gate to require data-residency guard test pass.
