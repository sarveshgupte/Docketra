# Pilot Support Readiness

## Key operational signals now available
- **Auth refresh diagnostics:** machine-readable `reasonCode` on refresh failures + pilot-ops refresh events.
- **Intake diagnostics:** `warningDetails`, `workflowSteps`, and `intakeDiagnostics.lastFailureReason` on lead metadata.
- **Routing visibility:** intake/routing failures emit normalized reason codes (missing mapping, inactive workbench, missing client).
- **Onboarding blockers:** onboarding progress now includes structured blocker codes and next checks.
- **Report export failure trace:** failed CSV/Excel exports now emit warning events and `REPORT_EXPORT_FAILED` audit entries.
- **Storage export diagnostics:** backup/export failures and download-link limitations emit structured reason codes and pilot events.
- **Storage trust visibility:** admins can view storage mode, export entry points, and recent export-run status in storage settings.

## Warning/failure vocabulary (controlled)
- `missing_client`
- `missing_routing`
- `inactive_workbench`
- `invalid_origin`
- `refresh_not_supported`
- `idempotent_replay`
- `firm_context_missing`
- `setup_incomplete`
- `missing_contact`
- `report_export_failed`
- `missing_refresh_token`
- `storage_export_failed`
- `export_download_unavailable`
- `backup_runs_fetch_failed`

## Where to look first
- **Auth issues:** auth refresh response `reasonCode`; refresh reject/success pilot-ops events.
- **Intake issues:** lead `metadata.intakeOutcome` + `metadata.intakeDiagnostics` (`warningDetails`, `workflowSteps`).
- **Routing issues:** intake warning codes (`missing_routing`, `inactive_workbench`, `missing_client`) and routing step status.
- **Onboarding stalls:** onboarding progress `blockers[]` codes + `nextCheck` hints.
- **Report/export issues:** admin audit trail for `REPORT_EXPORT_FAILED` + report export warning events.
- **Storage ownership/recovery issues:** storage export reasonCode (`storage_export_failed`), download-unavailable reasonCode, and settings-audit records for export operations.

## What is now auditable
- Failed report exports (`REPORT_EXPORT_FAILED`).
- Storage export generation/failure/download-link issuance in settings audit + pilot diagnostics.
- Docket creation from intake (existing docket audit events still captured).
- Intake replay/routing/client-resolution outcomes via persisted lead diagnostics.
- Existing admin high-risk actions remain covered by admin audit logs.

## Biggest remaining blind spots
- No centralized timeline view that correlates auth + intake + routing + export signals in one place.
- No alerting/escalation layer (signals are available but not auto-alerted).
- Some non-CMS ingestion paths still have lighter diagnostics than CMS/public/API intake.

## Pilot readiness guardrails update (April 25, 2026)

### Recovery states added
- Shared recovery-copy map for auth, access-denied, storage, upload, tenant-scope, and inactive client/user states.
- Shared access-denied UX state with safe explanation + back/dashboard actions.
- Upload recovery in docket attachments now resolves to controlled safe copy and includes support context.
- Storage settings errors now resolve to role-aware recovery copy and support context.

### Request ID and support context behavior
- User-facing recovery states now use a tenant-safe support context containing only request ID, reason code, module, timestamp, and user-safe status.
- Support context intentionally excludes stack traces, request/response payloads, tokens, cookies, signed URLs, and tenant-private data.

### Role-specific storage guidance
- Storage recovery copy explicitly distinguishes Primary Admin/Admin remediation vs normal-user “contact your admin” guidance.

### Admin-safe diagnostic boundaries
- Diagnostics panel labels and fields are now tenant-safe and restricted to workflow category + request ID + reason code + recommended next action.

### Manual QA checklist
1. Expire a session and confirm one redirect + one user-facing session-expired message.
2. Trigger 403 on queue/report pages and verify shared access-denied state appears.
3. Trigger storage configuration failure as admin and non-admin; verify guidance differs safely.
4. Trigger upload failure codes and verify copy is safe and actionable.
5. Verify support context includes request ID when backend provides `X-Request-ID`.
6. Verify no tokens/cookies/stack traces/payloads appear in recovery UI.

### Known follow-ups
- Expand access-denied shared state to remaining legacy pages that still use page-specific inline errors.
- Add end-to-end browser tests for session-expiry multi-tab behavior.
