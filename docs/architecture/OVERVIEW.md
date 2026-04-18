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

## CMS -> CRM -> Task Manager Intake Flow

- Public and CMS-origin form submissions are orchestrated by `src/services/cmsIntake.service.js`.
- The canonical pipeline is:
  1. Validate submission payload
  2. Create `Lead` (always)
  3. Optionally upsert canonical `Client`
  4. Optionally create `Docket` (`Case` model)
  5. Return normalized intake result + metadata/warnings
- Controller responsibilities are intentionally thin: parse request metadata, call service, return response.
- Firm-level `intakeConfig.cms` controls auto-create behavior and default routing hints:
  - `autoCreateClient`
  - `autoCreateDocket`
  - `defaultWorkbasketId`
  - `defaultCategoryId`
  - `defaultSubcategoryId`
  - `defaultPriority`
  - `defaultAssignee`

## BYOAI Architecture (Data-Minimal / Firm-Controlled)

Docketra treats AI as an **orchestration layer**, not a long-term storage layer for AI content.

### Core principles
- AI is optional and firm-controlled at runtime.
- BYOAI mode requires firm-controlled credentials for the selected provider (encrypted API key or credential reference).
- There is no silent fallback to platform/system API keys in BYOAI mode.
- Switching providers requires new valid credentials (or credential reference) for that provider to prevent stale-credential reuse.
- `credentialRef` is treated as a valid configured credential source for admin status and policy checks.
- Prompt/context processing is transient by default.
- Docketra stores minimal AI operational metadata, not raw request/response bodies.
- Final business records store only accepted final content unless a firm explicitly enables broader retention.

### What Docketra stores for BYOAI
- Firm-level AI config (provider, model, encrypted API key or credential reference).
- Feature toggles, role access controls, and privacy/retention toggles.
- Minimal audit telemetry: request id, feature, provider, model, token usage, latency, status, timestamps, and redacted error metadata.
- Optional prompt templates only when configured as product settings.

### What Docketra does not store by default
- Full prompts.
- Full source documents sent as AI context.
- Raw AI request payloads.
- Raw AI response payloads.
- Hidden AI copies of firm business data.

### Zero-retention behavior
- `aiConfig.retention.zeroRetention=true` enforces `savePrompts=false` and `saveOutputs=false`.
- Verbose AI logging is disabled by default and can only be explicitly enabled by firm admins.
- Error metadata is redacted by default.

### Fallback behavior (AI disabled or unconfigured)
- If firm AI is disabled, unconfigured, or role-restricted, AI endpoints fail gracefully with explicit non-sensitive error codes.
- Core docket workflows remain functional without BYOAI.
