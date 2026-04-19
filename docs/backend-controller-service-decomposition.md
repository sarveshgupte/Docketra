# Backend Controller / Service Decomposition Guide

## Why this pattern exists

Large controllers are harder to review, riskier to modify, and more likely to regress across auth, tenant scoping, and audit behavior.  
Docketra backend handlers should stay thin and delegate orchestration/business rules to domain services.

## Preferred structure for large backend domains

### 1) Route layer
- Owns path/method wiring only.
- Binds middleware order (auth, role checks, rate limiting, write guards).

### 2) Controller layer
- Parses request input (`params`, `query`, `body`).
- Collects security context (actor, firm/tenant, request metadata).
- Calls one or more service functions.
- Shapes HTTP response payloads.
- Maps known errors to status codes.

### 3) Service / use-case orchestration
- Encapsulates multi-step domain workflows.
- Handles transaction boundaries and idempotency checks where needed.
- Owns shared normalization and lifecycle rules.
- Keeps logic reusable across multiple controllers/endpoints.

### 4) Validators / helpers
- Keep domain-specific normalization close to the domain.
- Prefer explicit helpers (e.g., settings normalization, lifecycle status normalization) over in-handler inline blocks.

### 5) Audit/logging helpers
- Compose and emit audit/security events in dedicated helpers/services.
- Audit failures should usually be non-fatal unless compliance requires hard-fail behavior.

## Guardrails to prevent controller monolith regressions

- Do not introduce new business rules directly in controllers when the rule can live in a service.
- If a helper is reused by multiple actions in a controller, extract it.
- Keep response shapes/API contracts unchanged during refactors.
- Preserve tenant boundaries and role hierarchy checks exactly as before.
- Prefer incremental decomposition per domain (auth/admin/superadmin) instead of repo-wide rewrites.

## Practical checklist for refactor PRs

- Controller remains responsible for request/response concerns only.
- Service module contains extracted orchestration or reusable domain logic.
- Existing auth, permission, tenant, audit, and transaction behavior is preserved.
- Regression tests added/updated for extracted units and touched flows.
