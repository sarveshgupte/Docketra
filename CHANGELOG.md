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
