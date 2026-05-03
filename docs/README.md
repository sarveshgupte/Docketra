# Docketra Documentation Index

This is the canonical entry point for all Docketra documentation.

For a product-facing overview, see the [root README.md](../README.md).
For a developer quick start, see [QUICK_START.md](../QUICK_START.md).

---

## Setup and local development

| Document | Purpose |
|----------|---------|
| [../QUICK_START.md](../QUICK_START.md) | Install, configure, and run Docketra in 10 minutes |
| [local-development.md](local-development.md) | Windows/Docker notes, Redis fallback behavior |
| [deployment/environment-variables.md](deployment/environment-variables.md) | All environment variables, categories, and defaults |
| [deployment/render-deployment.md](deployment/render-deployment.md) | Production deployment on Render |
| [../DEPLOYMENT.md](../DEPLOYMENT.md) | Deployment guide (Render-first) |

---

## Testing

| Document | Purpose |
|----------|---------|
| [testing/local-testing.md](testing/local-testing.md) | How to run backend and frontend test suites locally |
| [operations/ci-release-gates.md](operations/ci-release-gates.md) | CI release gate checks |
| [operations/release-gate.md](operations/release-gate.md) | Release gate detail |

---

## Product and modules

| Document | Purpose |
|----------|---------|
| [product/current-product-overview.md](product/current-product-overview.md) | Current product truth — modules, concepts, terminology |
| [product/PRD_DOCKETRA.md](product/PRD_DOCKETRA.md) | Product requirements document (MVP baseline) |
| [product/MVP_SCOPE.md](product/MVP_SCOPE.md) | MVP scope and beta gate criteria |
| [product/MODULE_REQUIREMENTS.md](product/MODULE_REQUIREMENTS.md) | Per-module functional requirements |
| [product/MODULE_OPERATING_MODEL.md](product/MODULE_OPERATING_MODEL.md) | How each module operates end-to-end |
| [product/NON_NEGOTIABLES.md](product/NON_NEGOTIABLES.md) | Hard product constraints |
| [product/USER_ROLES_AND_PERMISSIONS.md](product/USER_ROLES_AND_PERMISSIONS.md) | Role hierarchy and permissions matrix |
| [product/glossary.md](product/glossary.md) | Canonical terminology: Docket, Firm, xID, BYOS, etc. |
| [product/navigation-and-terminology-model.md](product/navigation-and-terminology-model.md) | Product navigation labels vs internal route names |
| [product/login-identifier-model.md](product/login-identifier-model.md) | Login identifier (xID / email) model |
| [product/storage-and-data-ownership.md](product/storage-and-data-ownership.md) | BYOS posture and data ownership principles |

---

## Architecture

| Document | Purpose |
|----------|---------|
| [architecture/OVERVIEW.md](architecture/OVERVIEW.md) | High-level architecture overview |
| [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) | Backend architecture detail |
| [architecture/tenant-identity-model.md](architecture/tenant-identity-model.md) | Multi-tenant identity and firm-scoping model |
| [architecture/byos-storage-model.md](architecture/byos-storage-model.md) | BYOS storage architecture |
| [architecture/auth-routing-session-model.md](architecture/auth-routing-session-model.md) | Auth, session, and firm-scoped routing model |
| [architecture/backend-runtime-entrypoints.md](architecture/backend-runtime-entrypoints.md) | API vs worker runtime split |
| [architecture/runtime-boundaries-render.md](architecture/runtime-boundaries-render.md) | Render service boundary and scheduler ownership |
| [frontend-routing-model.md](frontend-routing-model.md) | Frontend routing model and firm slug conventions |

---

## Security

| Document | Purpose |
|----------|---------|
| [security/SECURITY_MODEL.md](security/SECURITY_MODEL.md) | Comprehensive security model |
| [security/SECURITY.md](security/SECURITY.md) | Security policy |
| [security/tenant-isolation.md](security/tenant-isolation.md) | Tenant isolation guarantees |
| [security/auth-session-model.md](security/auth-session-model.md) | JWT auth and session model |
| [security/FIRM_SCOPED_LOGIN_SECURITY.md](security/FIRM_SCOPED_LOGIN_SECURITY.md) | Firm-scoped login security |
| [security/FIRM_SCOPED_ROUTING_SECURITY.md](security/FIRM_SCOPED_ROUTING_SECURITY.md) | Firm-scoped routing security |
| [security/JWT_SECURITY_SUMMARY.md](security/JWT_SECURITY_SUMMARY.md) | JWT security summary |
| [security/MULTI_TENANCY_SECURITY.md](security/MULTI_TENANCY_SECURITY.md) | Multi-tenancy security |
| [security/production-security-hardening.md](security/production-security-hardening.md) | Production hardening checklist |
| [security/redis-production-requirements.md](security/redis-production-requirements.md) | Redis requirements for production |
| [security/production-env.md](security/production-env.md) | Production environment security requirements |

---

## Operations and pilot readiness

| Document | Purpose |
|----------|---------|
| [operations/pilot-readiness-checklist.md](operations/pilot-readiness-checklist.md) | Pilot readiness checklist |
| [operations/pilot-support-readiness.md](operations/pilot-support-readiness.md) | Pilot support readiness |
| [operations/superadmin-diagnostics.md](operations/superadmin-diagnostics.md) | Superadmin diagnostics guide |

---

## Module and feature reference

| Document | Purpose |
|----------|---------|
| [BYOS_STORAGE_SETUP.md](BYOS_STORAGE_SETUP.md) | BYOS storage setup guide |
| [BYOAI_SETUP.md](BYOAI_SETUP.md) | BYOAI (Bring Your Own AI) setup |
| [bulk-upload.md](bulk-upload.md) | Bulk upload flow |
| [cms-form-editor-ux.md](cms-form-editor-ux.md) | CMS / Knowledge Intake form editor UX |
| [crm-ux.md](crm-ux.md) | CRM / Relationships UX |
| [workspace-design-system.md](workspace-design-system.md) | Workspace design system reference |

---

## Auth troubleshooting

| Document | Purpose |
|----------|---------|
| [auth-session-troubleshooting.md](auth-session-troubleshooting.md) | Auth session troubleshooting |
| [auth-troubleshooting.md](auth-troubleshooting.md) | General auth troubleshooting |

---

## Release history

| Document | Purpose |
|----------|---------|
| [whats-new.md](whats-new.md) | Running changelog of product and platform updates |
| [../CHANGELOG.md](../CHANGELOG.md) | Version-tagged changelog |
| [changelog/documentation-cleanup.md](changelog/documentation-cleanup.md) | Documentation cleanup summary (this sprint) |

---

## Archived / historical documents

Documents in [archive/](archive/) are preserved for historical reference but **do not reflect current product state**. Do not rely on archived documents for current setup, API examples, or product decisions.

| Document | Notes |
|----------|-------|
| [archive/pr-auth-stabilization-description.md](archive/pr-auth-stabilization-description.md) | PR notes: auth stabilization follow-up |
| [archive/phase1-uiux-maturity-sprint.md](archive/phase1-uiux-maturity-sprint.md) | Historical UX sprint planning notes |
| [archive/codebase-audit-report.md](archive/codebase-audit-report.md) | Historical codebase audit snapshot |
| [features/pr-history/](features/pr-history/) | Per-PR implementation summaries |
| [security/](security/) | PR-specific security summaries (files prefixed `PR_`) are historical records |
