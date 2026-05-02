# Superadmin Platform Command Center

## Overview
`/app/superadmin` is the primary **Platform Command Center** for superadmins. It provides cross-firm operational KPIs, attention queues, and quick navigation into existing superadmin workflows.

## Current Features
- KPI cards:
  - Total firms
  - Active firms
  - Suspended/inactive firms
  - Total users
  - Firms needing onboarding follow-up
  - Recent auth/OTP failure count (when available)
  - Slow endpoint p95 latency (when available)
- “Needs attention today” summary:
  - Stale onboarding firms/users
  - Firms with storage health issues
  - Admins not verified / invite pending
  - Recent failed login/OTP issues
- Quick links:
  - Firms Management
  - Onboarding Insights
  - Support Diagnostics
- Graceful state handling:
  - Loading state
  - Empty/unavailable state
  - Partial/degraded data state
  - Retry actions

## Data Sources
The command center reuses existing superadmin endpoints:
- `GET /api/superadmin/stats`
- `GET /api/superadmin/onboarding-insights`
- `GET /api/superadmin/diagnostics`

No new backend endpoint is required for this iteration.

## Access Control
All superadmin routes remain protected behind superadmin-only access checks (`requireSuperadmin`) in backend routing, and protected route handling in the UI.

## Privacy Boundaries
The command center is intentionally redacted and platform-scoped:
- Does **not** expose client records.
- Does **not** expose docket/task payloads.
- Does **not** expose attachment/document content.
- Does **not** expose private client content.

Displayed data is aggregate or operational metadata intended for platform health triage.

## Extension Points
Potential future enhancements:
- Trendlines for KPI movement (7-day and 30-day deltas)
- Alert acknowledgements and ownership workflows
- Direct links to filtered diagnostics and onboarding details
- Configurable thresholds for “needs attention” categories
- Optional incident timeline panel using request IDs/audit events
