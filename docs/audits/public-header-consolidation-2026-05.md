# Public Header Consolidation Audit (May 2026)

## Scope
- Public homepage (`/`)
- Workspace discovery/login entry (`/find-workspace`)
- Public marketing/legal pages that use `MarketingLayout`

## Findings
- Public header markup and nav vocabulary were duplicated across home and marketing-layout pages.
- `/find-workspace` inherited an outdated header variant (`Features`, `How it Works`, `Use Cases`, `Pricing`, `Security`, `About`, `Create your workspace`).
- Homepage used current task-manager launch copy, causing inconsistent product positioning between public surfaces.

## Changes applied
- Consolidated public headers into one shared component: `ui/src/components/marketing/PublicMarketingHeader.jsx`.
- Updated `ui/src/components/layout/Navbar.jsx` to delegate directly to the shared header component so all `MarketingLayout` pages (including `/find-workspace`) use identical public navigation and CTA behavior.
- Updated homepage landing content to use the same shared header component.
- Standardized nav vocabulary and CTAs to:
  - Why
  - Product
  - Workflow
  - Pilot readiness
  - Trust
  - Workspace login
  - Start managing work

## Guardrails
- Preserved route behavior:
  - Workspace login CTA still targets `/find-workspace`.
  - Primary CTA still targets `/signup`.
- No backend/auth logic changes.
- Added source-level regression tests to ensure stale labels cannot regress on public header surfaces.
