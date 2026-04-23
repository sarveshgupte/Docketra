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
