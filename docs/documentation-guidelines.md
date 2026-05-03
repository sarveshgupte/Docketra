# Documentation Contribution Guidelines

Use this guide for every feature PR so docs stay accurate, navigable, and current.

## Canonical documentation sources

The following are the primary sources reviewers should trust first:

- Root [README.md](../README.md) for platform overview and operating posture.
- [QUICK_START.md](../QUICK_START.md) for local setup and first run.
- [docs/README.md](README.md) for full documentation index and routing.
- [docs/whats-new.md](whats-new.md) for current update history.
- Relevant domain docs for details, including:
  - product docs under `docs/product/`
  - security docs under `docs/security/`
  - deployment docs under `docs/deployment/`
  - testing docs under `docs/testing/`
  - architecture docs under `docs/architecture/`

## Archive vs current docs

- Anything in `docs/archive/` is historical reference only and is not canonical for current behavior.
- PR/implementation summaries should be stored in historical locations (`docs/archive/`, `docs/features/pr-history/`, or changelog/history docs) unless the content is needed as a current operating guide.
- If a historical summary contains still-relevant procedures, copy the maintained procedure into a current canonical doc and keep the summary as context only.

## Feature documentation checklist (required per feature PR)

For every feature PR, update at least one of:

- `docs/whats-new.md`, or
- the relevant product doc, or
- the relevant architecture/security/testing doc.

Additional required updates by change type:

- UI/UX changes: update the relevant frontend or design doc (for example `docs/frontend-routing-model.md`, `docs/workspace-design-system.md`, or module UX docs).
- Security-sensitive changes: update the relevant `docs/security/*` documentation.
- Deployment/config changes: update `docs/deployment/*` and any impacted setup references.

## Documentation quality guardrails

- Run `npm run docs:check` before opening or updating a PR.
- Ensure markdown links resolve to valid in-repo targets.
- External links are allowed but should be reviewed for correctness.
- Archive scopes (`docs/archive/`, `docs/features/pr-history/`) are intentionally excluded from strict link failure checks because they are historical snapshots.

