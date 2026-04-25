# Docketra

Docketra is a **B2B firm operations SaaS** that connects intake, relationship management, and execution into one firm-scoped workspace.

It is built for teams that need to run predictable operations across:
- lead capture and intake (CMS),
- client and pipeline management (CRM),
- docket execution, allocation, QC, and reporting (Task Manager).

> Canonical work item term: **Docket** (legacy `/cases` routes remain compatibility aliases).

## Who Docketra is for

- Professional service firms (tax, compliance, legal-adjacent ops, finance ops, back-office teams).
- Operations leads who need queue discipline, role-based work allocation, and auditability.
- Firms that require data control with a **BYOS-first** (Bring Your Own Storage) posture.

## Core product modules

1. **CMS (Intake / Acquisition)**
   - Request links, hosted forms, embed forms, API intake.
   - Unified intake pipeline: submission → lead → optional client → optional docket.

2. **CRM (Relationship Management)**
   - Lead pipeline (`new`, `contacted`, `qualified`, `converted`, `lost`).
   - Ownership, follow-up tracking, client records, and relationship history.

3. **Task Manager (Execution)**
   - Dockets, Workbasket, My Worklist, QC queue, all-dockets oversight.
   - Work allocation, lifecycle transitions, attachment handling, and audit trail.

4. **Operations & Platform Controls**
   - Reports, onboarding guidance, team/access controls, security settings, storage settings.

## High-level architecture

- **Frontend**: React + Vite app in `ui/`.
- **Backend API**: Node.js + Express in `src/`.
- **Database**: MongoDB (firm-scoped multi-tenant model).
- **Queue/Workers**: Redis + worker processes for async jobs.
- **Security layers**: JWT auth, firm-context enforcement, rate limiting, audit logging, request IDs, environment validation.

```text
Web UI (ui/)  -->  API (src/server.js / routes/controllers/services)
                     |
                     +--> MongoDB (tenant-scoped records)
                     +--> Redis + workers (background jobs)
                     +--> Optional integrations (Google auth/storage, email, AI)
```

## Local setup

### Prerequisites
- Node.js 18.x
- npm 9+
- MongoDB (local or container)
- Redis (recommended for full worker/rate-limit behavior)

### 1) Install dependencies

```bash
npm install
npm --prefix ui install
```

### 2) Configure environment

```bash
cp .env.example .env
```

Minimum local variables:

```dotenv
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/docketra
JWT_SECRET=<at least 32 random chars>
SUPERADMIN_XID=X000001
SUPERADMIN_EMAIL=superadmin@example.com
SUPERADMIN_PASSWORD_HASH=<bcrypt hash>
SUPERADMIN_OBJECT_ID=000000000000000000000001
ENCRYPTION_PROVIDER=disabled
REDIS_URL=redis://localhost:6379
```

### 3) Start backend and frontend

```bash
# backend API
npm run dev

# background worker (separate terminal)
npm run start:worker

# frontend app (separate terminal)
npm --prefix ui run dev
```

## Environment variables (required/important)

Use `.env.example` as the source of truth. Key categories:
- **Core runtime**: `NODE_ENV`, `PORT`, `APP_NAME`
- **Database**: `MONGO_URI` (and legacy `MONGODB_URI`)
- **Auth & security**: `JWT_SECRET`, superadmin bootstrap vars, rate limit vars
- **Encryption**: `ENCRYPTION_PROVIDER`, `MASTER_ENCRYPTION_KEY` (when enabled)
- **Storage/Integrations**: Google OAuth vars, storage token secret, upload controls
- **Ops/diagnostics**: `METRICS_TOKEN`, CSP reporting toggle, build metadata
- **Frontend build vars**: `VITE_*` keys (can live in root `.env` or `ui/.env`)

## Build, test, and verification commands

### Backend
```bash
npm run lint
npm run validate:env
npm run test
```

### Frontend
```bash
npm --prefix ui run build
npm --prefix ui run test:ci
```

### Release gate (CI-equivalent local check)
```bash
npm run ci:release-gate
```

## Deployment notes

- Production deploy targets are documented in `docs/deployment/render-deployment.md`.
- Build relies on backend install + `ui` build (`npm run build` / `heroku-postbuild`).
- Ensure production secrets are set explicitly (JWT, encryption/storage, metrics token, OAuth creds).
- Run env validation and release gate checks before deployment.
- Keep worker process enabled in production for async and queue-driven workflows.

## Security and data ownership principles

- **Firm-scoped isolation**: tenant boundaries are enforced across auth, routing, and data access.
- **Role hierarchy**: permissions align to primary admin > admin > manager > user.
- **BYOS-first posture**: firm data ownership is prioritized; external storage/integrations remain explicit and configurable.
- **Auditability by default**: security-sensitive and operational actions are logged with traceability.
- **Fail-safe optional services**: platform behavior remains functional even when optional providers (for example, AI/integrations) are disabled.

## Documentation map

- Current product overview: `docs/product/current-product-overview.md`
- Pilot readiness checklist: `docs/operations/pilot-readiness-checklist.md`
- Release updates: `docs/whats-new.md`
- Deployment: `docs/deployment/render-deployment.md`
- Security: `docs/security/SECURITY_MODEL.md` and `docs/security/`
