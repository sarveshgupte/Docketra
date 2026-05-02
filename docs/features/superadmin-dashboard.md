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

## Firm 360 Detail Page
- Route: `/app/superadmin/firms/:firmId`
- Purpose: a firm-level superadmin cockpit for lifecycle and support metadata only.

### Safe data shown
- Firm identity metadata: firm name, firmId, slug, status, createdAt, login URL, client/user counts, admin email (if already exposed).
- Admin management metadata from existing admin lifecycle endpoints: masked email, status, system-admin flag, last login, invite/password setup timestamps when available.
- Onboarding health metadata: completion state, stale/incomplete user counts, blockers, and next suggested action.
- Storage/BYOS metadata: storage mode/provider/health and connection signal.
- Plan/limits metadata when available: plan, maxUsers, subscriptionStatus, billingStatus, billingOwnerId.
- Support diagnostics metadata: redacted login/OTP issue counts, request IDs, storage issue summary, slow endpoint p95.

### Privacy boundaries
The page explicitly enforces and states that superadmin access is limited to platform lifecycle/support metadata and does not expose firm client records, dockets, tasks, attachments, documents, or private client content.

### Admin actions supported
- Resend admin access
- Force password reset
- Enable/disable admin
- Add additional admin (via existing Firms Management modal flow)
- Delete non-system admin

### Future extension points
- Per-firm trend sparklines for onboarding and auth issue velocity.
- Severity scoring for proactive escalation.
- Direct deep-links to filtered diagnostics incidents for support workflows.


## Audit Log Viewer
- Route: `/app/superadmin/audit`
- API: `GET /api/superadmin/audit-logs` (superadmin-only, paginated, newest first, limit capped at 100).

### Safe fields shown
- timestamp
- actionType
- performedBy
- targetEntityType
- targetEntityId
- firmId / firmName (if present in safe metadata)
- requestId (if present)
- ipAddress / userAgent only when already present in audit rows
- short metadata summary (sanitized primitives only, sensitive keys redacted)

### Filters
- actionType
- actor
- targetEntityType
- firmId
- date range (`from`, `to`)
- free text (`search`)
- pagination (`page`, `limit`)

### Privacy boundaries
Audit log viewer is platform lifecycle/support scoped only. It must never return or expose client records, dockets, tasks, attachments, documents, passwords, hashes, OTPs, auth/session tokens, reset tokens, secrets, or private client content.

### Extension points
- Add actionType dropdown sourced from model enum.
- Add CSV export with same sanitization guardrails.
- Add requestId drill-down to diagnostics incidents for support triage.

## Superadmin Global Search
- Route: `/app/superadmin` (within `SuperAdminLayout` shell search panel).
- API: `GET /api/superadmin/search` (requires `requireSuperadmin` + superadmin policy authorization).
- Query params:
  - `q` (trimmed; max 100 chars)
  - `types` optional comma list (`firms,admins,audit`)
  - `limit` optional, capped at 25

### Searchable entities
- Firms (platform firm identity + lifecycle status)
- Admins (platform admin identity/support metadata)
- Audit references (platform action metadata for request/target correlation)

### Safe result fields returned
- Grouped response shape:
  - `{ firms: [], admins: [], audit: [] }`
- Firm result:
  - `type`, `id`, `firmId`, `firmSlug`, `name`, `status`, optional `adminEmailMasked`, `href`
- Admin result:
  - `type`, `id`, `firmId`, `firmName`, `xID`, `name`, `emailMasked`, `status`, `href`
- Audit result:
  - `type`, `id`, `actionType`, `performedBy`, `targetEntityType`, `targetEntityId`, `firmId`, `firmName`, `requestId`, `timestamp`, `href`

### Privacy boundaries
Global search is platform lifecycle/support scoped only. It does **not** search or return client records, docket/task payloads, attachments/documents, private client content, passwords, OTPs, tokens, cookies, secrets, storage credentials, or auth header values.

### Extension points
- Add type chips/toggles in UI (firms/admins/audit) that map directly to `types` query param.
- Add keyboard navigation and recent search suggestions (superadmin-only, ephemeral client state).
- Add requestId deep-link presets to diagnostics/audit filtered views.

## Firm Health and Risk Queue

- **UI route:** `/app/superadmin/firm-health`
- **API route:** `GET /api/superadmin/firm-health`
- **Access:** `requireSuperadmin` + superadmin platform policy authorization.
- **Query params:**
  - `limit` optional, capped at `100`
  - `status` optional: `healthy | watch | at_risk | critical`
  - `search` optional, capped to `100` chars and regex-escaped

### Score signals (safe metadata only)

Firm health starts at `100` and subtracts deterministic penalties for:
- inactive/suspended lifecycle status
- no verified admin-access signal
- stale onboarding users
- incomplete onboarding users
- storage health not `HEALTHY`/unknown
- no active usage/admin signal

Scores are clamped to `0..100`.

### Risk levels

- `80-100`: healthy
- `60-79`: watch
- `40-59`: at_risk
- `0-39`: critical

### Privacy boundaries

The Firm Health view only surfaces platform lifecycle/support metadata and never returns client records, dockets, tasks, attachments, documents, storage credentials, raw admin emails, tokens, OTPs, passwords, cookies, auth headers, or other secrets/private content.

### Extension points

- Add platform-level auth degradation indicators (aggregate only) into `signals.auth`
- Add lightweight trend windows (e.g. 7-day score delta) from safe aggregate counters
- Add risk-notes workflow for superadmin operations without touching firm client data


## Plans & Capacity Management

- **UI route:** `/app/superadmin/plans` (Superadmin-only).
- **API:**
  - `GET /api/superadmin/plans`
  - `PATCH /api/superadmin/firms/:firmId/plan-capacity`
- **Safe fields shown:** firm identity/status metadata, plan, maxUsers, userCount, capacityUsedPercent, capacityStatus, subscriptionStatus, billingStatus, and safe links to Firm 360.
- **Editable fields:** `plan`, `maxUsers`, `subscriptionStatus`, `billingStatus`.
- **Validation:** `maxUsers` must be integer 1..500 and cannot be set below current active user count; invalid plan values are rejected.
- **Privacy boundaries:** no payment instruments, checkout/invoice artifacts, client records, dockets, tasks, documents, secrets, or private client content are returned.
- **Extension points:** additional read-only readiness metrics can be added to `GET /plans` totals/cards without introducing public billing flows.

## Pilot Readiness Checklist
- Route: `/app/superadmin/pilot-readiness` (Superadmin only).
- API: `GET /api/superadmin/pilot-readiness`.
- Categories: auth/route protection, firm creation/admin invite, firm health/risk queue, plans/capacity, onboarding, storage/BYOS, support diagnostics, audit logging, primary-admin sidebar route readiness, and no public billing/payment flows.
- Scoring: start 100, deduct 30 for fail and 10 for watch, clamp to `0..100`; `ready` if `score >= 85` and no fail, `watch` if `score >= 65`, else `blocked`.
- Privacy boundary: metadata-only surface. No tenant/client records, dockets, tasks, attachments, documents, emails, payment instruments, tokens, secrets, OTPs, or credentials.
- Extension points: add new checklist cards by extending `buildPilotReadinessSnapshot` and preserving redaction/privacy boundaries.
