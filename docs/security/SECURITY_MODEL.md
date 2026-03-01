# Security Model

Docketra applies defense-in-depth controls for a firm-scoped multi-tenant SaaS model.

## Core Security Principles

- **Tenant isolation by default** using firm-scoped access patterns.
- **Least privilege** via role and permission middleware.
- **Auditability** with auth/admin/case activity trails.
- **Operational guardrails** including rate limiting, idempotency, and request lifecycle checks.

## Security Controls in Practice

- Authentication and authorization middleware gates protected routes.
- Firm context middleware prevents tenant ambiguity and cross-tenant access.
- Repository guardrails (where implemented) enforce tenant-scoped data operations.
- Security events are captured through audit models and middleware hooks.

## Related Security Documents

The detailed security implementation history is consolidated under this folder, including:

- `SECURITY.md`
- `SECURITY_ANALYSIS.md`
- `SECURITY_SUMMARY.md`
- PR-level `*_SECURITY*.md` summaries
