# Performance Parallelization Guardrails

This PR keeps performance improvements while preserving authorization freshness and security guarantees.

Rule: **Parallelize independent child lookups only after required parent/tenant validation has passed; never weaken authorization freshness or security tests for performance.**

Applied patterns:
- Validate tenant/parent entity existence first (`deal`, `client`).
- After validation, run only independent child lookups concurrently with `Promise.all`.
- Keep all child queries tenant-scoped (`firmId`) and parent-scoped (`dealId`/`clientId`).
- Keep permission checks revocation-safe by resolving firm membership from DB source-of-truth before authorization decisions.
- Keep security tests deterministic with explicit, configured thresholds (no open-ended loops).
