# Docketra Pilot Manual QA Checklist & Demo-Data Runbook (May 2026)

## Purpose
This runbook is a **manual pre-pilot gate** for founders/operators before onboarding any pilot firm.

- It is intentionally practical and non-technical.
- It is designed for **dummy-data testing first**, then real-data readiness.
- It does **not** declare production readiness by itself.

### Required command before starting manual QA
Run this once and proceed only if it passes:

```bash
npm run test:pilot-readiness
```

This smoke command covers:
- backend route validation and mount order contracts
- auth pilot smoke checks
- tenant/admin boundary checks
- pure security/hardening/core checks
- frontend build + frontend CI checks

This command does **not** cover Mongo integration runtime tests. For that, run:

```bash
npm run test:pilot-readiness:integration
```

---

## 1) Pre-QA setup (must be confirmed before testing)
Mark each item Pass/Fail before running UI flows.

- [ ] Backend deployment is live and reachable in the pilot environment.
- [ ] Frontend deployment is live and reachable in the pilot environment.
- [ ] Required environment variables are present for backend and frontend.
- [ ] Redis is available and healthy in production/pilot environment.
- [ ] MongoDB is available and healthy in production/pilot environment.
- [ ] `npm run test:pilot-readiness` was run successfully.
- [ ] `npm run ci:release-gate:pure` status is known (recommended for merge/release confidence).
- [ ] Test firm is configured for **dummy data only** (no real client/firm records).

---

## 2) Demo data plan (prepare before walkthrough)
Create the following records using clearly fake, non-sensitive values:

### Firm + users
- [ ] 1 demo firm (example: `Demo Firm - Pilot QA`).
- [ ] 1 primary admin user.
- [ ] 1 admin user.
- [ ] 1 normal user.

### CRM + knowledge + dockets
- [ ] 3 dummy clients.
- [ ] 5 dummy dockets/tasks with mixed statuses (e.g., Open/In Progress/Done).
- [ ] Sample CRM records (notes, contact fields, status/pipeline where applicable).
- [ ] Sample CMS/knowledge records (titles, content, optional linkage).

### Files
- [ ] 1 non-sensitive dummy upload (PDF or image only; no real personal data).

**Dummy data hygiene rules:**
- Use obvious fake names, email domains, and phone numbers.
- Never paste real contracts, IDs, bank details, or legal client data.
- If uncertain, treat the data as sensitive and replace it with synthetic content.

---

## 3) Landing/public routes manual checks
- [ ] Home page loads without error.
- [ ] Login page loads without error.
- [ ] Signup/onboarding route loads (if exposed in this environment).
- [ ] Forgot-password route loads.
- [ ] Privacy / Terms / Security public pages load.
- [ ] No duplicate layout issue (double header/footer or duplicated shells).
- [ ] Mobile responsive sanity check for landing/auth pages.

---

## 4) Auth manual checks (firm users)
- [ ] Firm login initiation works.
- [ ] OTP verification works with valid OTP.
- [ ] Invalid OTP is rejected with clear error messaging.
- [ ] Forgot-password flow works.
- [ ] Reset-password flow works end-to-end.
- [ ] Logout works and session is cleared.
- [ ] Refreshing and reopening browser preserves/invalidates session as expected.
- [ ] Mobile browser login works.
- [ ] Protected routes redirect correctly when logged out.
- [ ] Public auth routes do not incorrectly redirect authenticated/unauthenticated users.

---

## 5) SuperAdmin manual checks
- [ ] SuperAdmin login works.
- [ ] SuperAdmin profile/session persistence behaves correctly after refresh.
- [ ] SuperAdmin logout works.
- [ ] SuperAdmin-only pages are inaccessible to firm users.
- [ ] Firm routes are not incorrectly captured by SuperAdmin routes.

---

## 6) Firm onboarding/admin checks
- [ ] Create/View/Update firm works (if this capability is enabled).
- [ ] Add users works.
- [ ] Role assignment works.
- [ ] Role boundaries hold (`primary admin > admin > manager > user`).
- [ ] Deactivate user works (if supported).
- [ ] Settings pages load without crash.
- [ ] AI/BYOAI settings remain configuration-only and are not represented as runtime AI behavior unless actually implemented.

---

## 7) Core workspace checks
- [ ] Dashboard loads for each relevant role.
- [ ] Main navigation works across primary modules.
- [ ] No double-sidebar/double-layout issue.
- [ ] Logout action is visible and functional from workspace.
- [ ] Browser refresh does not break authenticated workspace views.
- [ ] Loading, error, and empty states are acceptable and understandable.

---

## 8) CRM checks
- [ ] Client list loads.
- [ ] Create dummy client works.
- [ ] Edit dummy client works.
- [ ] Client detail view loads correctly.
- [ ] Search/filter works (if available).
- [ ] No broken placeholder routes or dead-end links in CRM flows.

---

## 9) CMS / knowledge checks
- [ ] Knowledge library loads.
- [ ] Create dummy knowledge item works.
- [ ] Edit dummy knowledge item works.
- [ ] Linking to work type/client/docket works (if supported).
- [ ] Unlinked/custom work type behavior is verified and acceptable.
- [ ] No claims of AI/vector/document extraction unless those features are truly implemented and enabled.

---

## 10) Docket/task checks
- [ ] Create docket/task works.
- [ ] Assign user works (if supported).
- [ ] Status updates work.
- [ ] Notes/comments work (if supported).
- [ ] Dummy file upload works (if supported).
- [ ] Docket/task detail view loads correctly.
- [ ] Dashboard counts/widgets update correctly after docket changes.

---

## 11) Storage/BYOS checks
- [ ] Default Docketra-managed storage path works for dummy uploads.
- [ ] BYOS connect/skip paths are clearly understandable to operator.
- [ ] BYOS disconnect behavior is safe (if feature exists).
- [ ] Tenant isolation check: no cross-firm/client data exposure.
- [ ] No raw file binary is stored in MongoDB (where current architecture specifies pointer/metadata-only storage).

---

## 12) Reports/admin/diagnostics checks
- [ ] Reports page loads.
- [ ] Admin pages load.
- [ ] Diagnostics pages do not expose secrets/tokens/internal credentials.
- [ ] Broken or redundant pages are documented as either:
  - pilot blockers, or
  - known limitations accepted for friendly pilot.

---

## 13) Mobile/browser matrix
Run at least this minimum matrix and capture pass/fail notes.

| Scenario | Result (Pass/Fail) | Notes |
|---|---|---|
| Chrome (desktop) |  |  |
| Safari or Chrome (mobile) |  |  |
| Incognito/private session |  |  |
| Refresh after login |  |  |
| Close & reopen browser after login |  |  |

---

## 14) Go / No-Go criteria

### Must pass before **dummy-data pilot**
- All Pre-QA setup checks complete.
- Auth baseline (login, OTP, logout, protected redirects) passes.
- Core workspace and navigation stable (no layout duplication regressions).
- Docket creation/update + CRM basic create/edit/view pass with dummy records.
- Storage path for dummy upload works without cross-tenant exposure.

### Must pass before **real-data pilot**
- Dummy-data pilot checklist is fully completed with no critical blockers.
- Role boundaries validated across primary admin/admin/manager/user.
- SuperAdmin and firm route boundaries validated (no privilege bleed).
- BYOS/storage handling validated for production expectations.
- Diagnostics/admin surfaces reviewed for secret exposure risk.
- Founder explicitly signs off that auth, storage, role boundaries, and core workflows are stable.

### Acceptable known limitations for a friendly pilot
- Minor copy/spacing/visual polish issues that do not block workflows.
- Non-critical low-priority pages that are clearly marked or out-of-scope.
- Optional feature gaps (e.g., advanced filters) with documented workaround.

**Not acceptable as known limitation:**
- Cross-tenant data leakage risk.
- Broken auth/session behavior.
- Role boundary bypass.
- Storage safety ambiguity for real firm data.

---

## 15) Pilot disclaimer (required)
**The first pilot must use dummy data only** until this manual QA checklist passes and the founder confirms: auth reliability, storage safety, role/access boundaries, and core workflow stability.

Even with `npm run test:pilot-readiness` passing, manual checks in this runbook are still required before Go/No-Go, especially workflow UX validation, role-behavior sanity, and browser/mobile verification.

---

## 16) Final sign-off table
Use this as the final release gate artifact for pilot readiness.

| Area | Tester | Date | Result | Notes | Blocker (Yes/No) |
|---|---|---|---|---|---|
| Pre-QA setup |  |  |  |  |  |
| Landing/public routes |  |  |  |  |  |
| Auth (firm) |  |  |  |  |  |
| SuperAdmin |  |  |  |  |  |
| Firm onboarding/admin |  |  |  |  |  |
| Core workspace |  |  |  |  |  |
| CRM |  |  |  |  |  |
| CMS/knowledge |  |  |  |  |  |
| Dockets/tasks |  |  |  |  |  |
| Storage/BYOS |  |  |  |  |  |
| Reports/admin/diagnostics |  |  |  |  |  |
| Mobile/browser matrix |  |  |  |  |  |
| Overall go/no-go decision |  |  |  |  |  |
