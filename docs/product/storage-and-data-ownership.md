# Storage & Data Ownership

## Purpose

The Storage & Data Ownership dashboard helps firm admins verify where their data lives and whether the firm BYOS connection is healthy.

## What admins can now see

- Active storage provider.
- Connection status.
- Last storage health check timestamp.
- Fallback/default storage status (`docketra_managed`).
- Backup and export readiness (enabled state + latest export metadata when available).
- Warning banners when BYOS is not configured or storage has health issues.

## Data ownership model copy shown in-product

Docketra is a control plane. Firm/client data should remain in the configured storage provider according to the firm data ownership configuration.

## Security guardrails

- Provider secrets are not exposed by the dashboard summary endpoint.
- Summary API is tenant-scoped and admin-gated.

## Endpoints

- `GET /api/storage/ownership-summary` — consolidated trust/ownership summary for settings UI.
- Existing storage endpoints remain unchanged for configuration, health checks, and exports.
