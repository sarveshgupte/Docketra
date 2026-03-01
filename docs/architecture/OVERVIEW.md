# Architecture Overview

Docketra is a multi-tenant Node.js + Express SaaS application backed by MongoDB (Mongoose).

## High-Level Layers

- **Routes**: HTTP endpoint definitions and request schema bindings.
- **Middleware**: authentication, permission checks, firm resolution, and request safety controls.
- **Controllers**: request parsing and HTTP response orchestration.
- **Services**: business logic and cross-entity orchestration.
- **Repositories**: firm-scoped persistence access.
- **Models**: Mongoose schemas and persistence contracts.

## Multi-Tenant Boundaries

- Tenant context is resolved through middleware and made available via `req.firmId` / `req.user.firmId`.
- Firm-scoped repositories are used to enforce per-tenant query filters.
- Superadmin and impersonation paths are handled with dedicated guardrails.

## Related Architecture Documents

- `ARCHITECTURE.md`
- `REPORTS_ARCHITECTURE.md`
- `FIRM_SCOPED_ROUTING_ARCHITECTURAL_FIXES.md`
