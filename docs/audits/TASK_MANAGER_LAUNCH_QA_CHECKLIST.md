# Task Manager Launch QA Checklist (Production Readiness)

Date: 2026-05-07
Scope: Task Manager-only launch validation after BYOS Google Drive OAuth stabilization.

## 1) Authentication and workspace boundaries
- [ ] Firm login succeeds and lands on firm workspace.
- [ ] Firm logout succeeds and clears firm session.
- [ ] Dashboard loads without CRM/CMS/knowledge dependency errors.
- [ ] Superadmin login and routes remain separate from firm workspace routes.

## 2) Task Manager critical flows
- [ ] Task Manager page loads.
- [ ] New docket/task can be created with required fields.
- [ ] Docket/task assignment works for allowed roles.
- [ ] Worklist/workbasket movement works (pull/assign/route/submit as applicable to role).
- [ ] No terminal-state queue regressions (resolved/filed are excluded from active queues as expected).

## 3) Attachment and storage flows
- [ ] Attachment upload works with default Docketra-managed storage (no BYOS required).
- [ ] If BYOS Google Drive is connected, attachment upload works in firm-connected mode.
- [ ] If BYOS connect/test fails, user messaging is clear and operators know they can continue using default Docketra-managed storage when BYOS is not connected.
- [ ] Upload/storage failures return actionable, non-technical messages and do not white-screen the page.

## 4) Settings access control
- [ ] Storage Settings page is accessible to PRIMARY_ADMIN and ADMIN.
- [ ] Normal employee user cannot access admin-only storage/settings routes.
- [ ] Storage Settings clearly states BYOS is optional and Docketra-managed storage is default.

## 5) Launch navigation scope
- [ ] Primary navigation emphasizes Task Manager/Work and Dashboard.
- [ ] Non-launch modules (CRM/CMS/Company Brain/Knowledge Library) are not exposed in primary nav for normal firm users.
- [ ] No dead-end primary nav links.

## 6) Smoke evidence to capture
- [ ] Screenshot: firm dashboard and task manager primary nav.
- [ ] Screenshot: storage settings optional BYOS/default managed copy.
- [ ] Screenshot: upload success in managed fallback mode.
- [ ] Screenshot: upload success in BYOS-connected mode (if configured).

## 7) Exit criteria
- [ ] Normal firm user can complete Task Manager flows without configuring BYOS.
- [ ] Primary Admin can configure/test BYOS, but setup is not mandatory.
- [ ] Superadmin boundary remains intact.
- [ ] Automated auth/storage/route tests pass in CI.


## 8) Evidence log destination
- [ ] Record final production smoke evidence in `docs/audits/PRIVATE_PILOT_READINESS_SIGNOFF_2026-05.md` under **Manual Production QA Evidence** before pilot GO decision.
