# Pilot plan behavior (testing phase)

Docketra is currently in a pilot/testing phase.

## Current firm plan defaults

- New self-serve / early-access firms default to `plan: "pilot"`.
- Pilot firms default to `maxUsers: 25`.
- Existing plans remain supported and valid:
  - `starter`
  - `professional`
  - `enterprise`

To preserve backward compatibility for existing records, uppercase legacy plan values are still accepted by model validation while canonical values are lowercase.

## User limit enforcement

- User capacity enforcement reads from `firm.maxUsers`.
- For starter firms, existing admin-seat restriction behavior is unchanged.

## Pricing and billing state

Public pricing is intentionally deferred during pilot/testing.

No public pricing page, pricing nav links, or billing/payment integration are introduced by this change.
Existing future-billing fields such as `billingStatus`, `subscriptionStatus`, and `planId` remain intact.


- Superadmin pilot operations now include `GET /api/superadmin/plans` and `PATCH /api/superadmin/firms/:firmId/plan-capacity` for safe metadata-only plan/capacity management during pilot readiness checks.

- Superadmin Pilot Readiness Checklist is the operational readiness surface for go/no-go pilot onboarding decisions (`GET /api/superadmin/pilot-readiness`).
