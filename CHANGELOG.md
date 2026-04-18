## [1.1.1] - 2026-04-18
### Changed
- Redesigned the marketing landing page for non-technical firm owners with a shorter conversion-first structure.
- Replaced technical module-first copy with plain business language focused on managing clients, work, documents, ownership, and follow-ups.
- Refactored `HomePage` into modular section components (hero, problem/solution, feature highlights, how it works, visual proof, use cases, final call to action) for maintainability.
- Added lightweight visual storytelling elements (before/after comparison, animated stat cards, hover interactions, and clean operational preview cards) without introducing new dependencies.

## [1.1.0] - 2026-04-18
### Added
- Introduced metadata-only backup tracking with `BackupJob` records (status, checksum, size, archive key, notification status).
- Added backup run listing endpoint: `GET /api/storage/exports`.
- Added firm-level backup admin settings under `settings.storageBackup` (enable flag, recipients, policy, retention days).
- Added firm-level BYOAI admin controls for feature toggles, role access, retention/privacy behavior, and credential references.
- Added `AiAuditLog` metadata-only telemetry (request id, feature, provider, model, latency, token counts, status) without raw payload persistence.

### Changed
- Refactored storage backup flow to:
  - create encrypted archives (`.zip.enc`),
  - upload archives to firm-owned external storage,
  - avoid persisting backup payloads in MongoDB.
- Updated storage export API responses to return metadata + secure retrieval link details instead of serving local ZIP files directly.
- Added nightly backup scheduler bootstrap in API server startup.
- Refactored AI orchestration to enforce firm-level enablement, role/feature gates, and graceful fallback behavior when AI is disabled or unconfigured.
- Hardened BYOAI credential semantics: no silent system-key fallback, provider switch now requires provider-valid credentials, and credential reference state is reflected in AI status responses.

### Security
- Added model-level guardrails that reject binary payload persistence for attachment/file metadata documents.
- Added backup audit events for creation/failure and download-link issuance.
- Hardened BYOAI with privacy-first retention defaults (zero-retention on, save prompts/outputs off by default) and redacted AI error logging.
- Fixed a docket AI runtime bug where request metadata was referenced outside scope during suggestions generation.

## [1.0.0] - 2026-03-01
### Added
- Consolidated documentation structure under `docs/architecture`, `docs/security`, and `docs/features`.
- Added architecture, security, and feature index entry points:
  - `docs/architecture/OVERVIEW.md`
  - `docs/security/SECURITY_MODEL.md`
  - `docs/features/FEATURE_INDEX.md`

### Changed
- Moved PR-specific and summary-heavy markdown documentation out of repository root into the `docs/` tree.
- Introduced a firm-scoped Task repository + service flow and updated task controller to call services.
- Extended environment validation to require `NODE_ENV` and support `MONGO_URI` (with backward compatibility for `MONGODB_URI`).

### Fixed
- Task read/write operations now enforce tenant scoping through repository queries using `firmId`.

### Security
- Reduced cross-tenant access risk in task endpoints by removing direct controller model access and enforcing firm-scoped repository filters.
