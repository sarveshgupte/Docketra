# BYOS Data Ownership and Recovery

## Storage modes (what admins should know)
- **Firm-connected storage (preferred for pilots/production):** document bytes and backup archives are stored in your firm-connected provider (Google Drive, OneDrive, S3-compatible).
- **Docketra-managed storage (fallback/default):** used when firm-connected storage is not configured or intentionally selected.
- Storage mode is visible in **Storage Settings** and shown with plain-language operational guidance.

## What firm-connected storage means
- Your firm controls the storage account, folder/container policy, retention policy, and downstream access control.
- Docketra remains the control plane for metadata, lifecycle, routing, and audit events.
- BYOS mode is recommended when firms require stronger data-location ownership trust.

## What Docketra-managed storage means
- Faster setup and fallback continuity for pilots.
- Useful as a temporary mode while BYOS is being configured.
- Not the preferred trust posture for firms with strict ownership/compliance requirements.

## Current exportable data groups
- **Storage backup/export archives** via storage export operations and export-run history.
- **Reports** (CSV/Excel) with explicit failure reason code and pilot diagnostics.
- **Docket audit/history views** (timeline + CSV timeline export on docket detail drawer).

## Current recovery paths
- Generate a firm export from Storage Settings (Primary Admin path).
- Review export run history and use export IDs for support escalation/recovery tracing.
- Use report exports for operational slices when full backup is not required.
- Use audit trails + pilot diagnostics to reconstruct workflow history and failure context.

## Current limitations (do not overpromise)
- No single “export everything” API for all domains in one artifact yet.
- Some data groups still rely on targeted exports plus support-assisted recovery workflows.
- Restore automation is not fully self-serve across all firm-owned entities.

## Export/backup failure handling expectations
- Export failures return structured reason codes and operator-facing messages.
- Export download-link limitations are explicit (not silent) and include recovery guidance.
- Export/backup operations emit pilot diagnostic signals and settings-audit records.

## Audit and diagnostic visibility for ownership operations
- Storage provider changes and export operations are written to settings audit.
- Pilot diagnostics include export success/failure and download-unavailable signals.
- Sensitive credentials are never surfaced in UI trust guidance or operator logs.

## Biggest remaining trust gaps after this PR
- Full-firm multi-domain export remains partially manual.
- Cross-surface “single recovery console” is still pending.
- Recovery runbooks are stronger, but complete self-serve restore is still limited.

