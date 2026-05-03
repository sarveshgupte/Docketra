# Documentation Cleanup — May 2026

This document summarizes the documentation cleanup sprint that aligned Docketra docs with the current product state.

---

## What was rewritten

### QUICK_START.md

Complete rewrite. Changes:

- Updated Node.js prerequisite from v14+ to **18.x**.
- Changed backend port references from `3000` to **5000** (the actual default).
- Removed outdated API examples using `/api/cases`, `/api/tasks`, and `/api/users` (these reflect an early single-tenant MVP; the current product is a multi-tenant firm workspace with firm-scoped auth).
- Removed references to non-existent files (`API_TESTING_GUIDE.md`, `ARCHITECTURE.md` at root).
- Added frontend setup step (`npm --prefix ui install`, `npm --prefix ui run dev`).
- Added frontend environment configuration step (`cp ui/.env.example ui/.env`).
- Added JWT/superadmin auth context and login path.
- Updated project structure to reflect current layout (including `ui/`).
- Added scripts reference table for both backend and frontend.
- Updated health check URL to port 5000.
- Updated "Next steps" links to valid current docs.

### ui/README.md

Complete rewrite. Changes:

- Removed "Neomorphic Web UI" framing and neomorphic design principles section (the current design system uses TailwindCSS; neomorphic language is no longer accurate product copy).
- Updated Node.js prerequisite from 14+ to **18.x**.
- Fixed env variable name: `VITE_API_URL` → **`VITE_API_BASE_URL`** (the actual variable in `ui/.env.example`).
- Removed xID-stored-in-localStorage auth description. Updated to reflect current **JWT cookie-based session** model.
- Replaced old feature checklist (Parts A–G, case-centric) with current module list (Work/Dockets, CRM, CMS, Company Brain, Knowledge Library, Clients, etc.).
- Updated project structure to reflect current `ui/src/` directories (`api/`, `auth/`, `constants/`, `design/`, `routes/`, etc.).
- Updated tech stack to include TailwindCSS 3, TanStack Query v5, react-hook-form, framer-motion (vendored).
- Added auth model section documenting JWT cookie-based sessions.
- Added workspace shell section (PlatformShell).
- Added navigation and product labels table.
- Added role hierarchy section.
- Added testing section with correct commands.

### README.md (root)

Minor update:

- Added `docs/README.md` as the first entry in the documentation map.
- Added links to `docs/deployment/environment-variables.md` and `docs/testing/local-testing.md`.

---

## What was created

### docs/README.md

New file. The canonical documentation index, organized by topic:

- Setup and local development
- Testing
- Product and modules
- Architecture
- Security
- Operations and pilot readiness
- Module and feature reference
- Auth troubleshooting
- Release history
- Archived / historical documents

### docs/deployment/environment-variables.md

New file. Comprehensive guide to all environment variables, organized by category:

- Server/application, database, frontend/CORS
- JWT and authentication
- Superadmin bootstrap
- Email delivery
- Google auth and BYOS storage
- Managed storage fallback
- Encryption
- Feature flags
- Redis
- Security rate limits
- File uploads and malware scanning
- Internal metrics and diagnostics
- Build metadata
- Frontend environment variables (`VITE_*`)
- Production security checklist

### docs/testing/local-testing.md

New file. Developer guide for running the test suites locally:

- Backend pure tests and integration tests
- Frontend CI test suite (17 tests) with individual test descriptions
- Full CI release gate (`npm run ci:release-gate`)
- Pilot readiness gate
- Environment tips for running without Redis or MongoDB

### docs/archive/

New directory. Contains preserved historical documents that are not current instructions:

- `pr-auth-stabilization-description.md` — PR notes for the auth stabilization follow-up.
- `phase1-uiux-maturity-sprint.md` — historical UX sprint planning notes.
- `codebase-audit-report.md` — historical audit snapshot (references old xID auth model).

### docs/changelog/documentation-cleanup.md

This file.

---

## What was labelled historical

The following root-level files were not deleted (to avoid breaking any in-flight references) but received "Historical note" banners at the top:

- `pr_description.md` — auth stabilization PR notes.
- `phase1-uiux-maturity-sprint.md` — UX sprint planning notes.
- `audit_report.md` — codebase audit snapshot referencing the xID auth model.

---

## Old assumptions removed

| Old assumption | Corrected in |
|----------------|-------------|
| Node.js v14+ | QUICK_START.md, ui/README.md |
| Backend runs on port 3000 | QUICK_START.md |
| xID stored in localStorage, sent as `x-user-id` header | ui/README.md |
| `/api/cases`, `/api/tasks`, `/api/users` API examples | QUICK_START.md |
| `VITE_API_URL` env variable | ui/README.md |
| Neomorphic-only UI design language | ui/README.md |
| References to non-existent `API_TESTING_GUIDE.md` / `ARCHITECTURE.md` | QUICK_START.md |

---

## How docs now map to the codebase

| Topic | Document | Verified against |
|-------|----------|-----------------|
| Backend port | QUICK_START.md, `.env.example` | `PORT=5000` in `.env.example` |
| Frontend env var | ui/README.md, env-variables.md | `ui/.env.example` |
| Auth model | ui/README.md | JWT cookie-based sessions in auth middleware |
| Test commands | testing/local-testing.md | `package.json` scripts |
| Frontend test command | ui/README.md, testing/local-testing.md | `ui/package.json` `test:ci` |
| Deployment | deployment/render-deployment.md, DEPLOYMENT.md | Render build/start commands |
| Navigation labels | ui/README.md | `ui/src/constants/platformNavigation.js` |
| Role hierarchy | ui/README.md | `HIERARCHY.md`, `docs/product/USER_ROLES_AND_PERMISSIONS.md` |
