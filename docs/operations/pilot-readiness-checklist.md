# Pilot Readiness Checklist

Use this checklist before onboarding pilot firms.

## 1) Product scope and messaging

- [ ] Pilot narrative matches current product model: **CMS + CRM + Task Manager + Reports + Onboarding + Security posture**.
- [ ] All pilot-facing material uses **Docket** terminology (not legacy “case” as primary language).
- [ ] Known limitations and non-goals are documented for pilot participants.
- [ ] Optional features/providers are clearly labeled as optional.

## 2) Workspace and tenant setup

- [ ] Firm workspace creation and login flow validated end-to-end.
- [ ] Role hierarchy configured correctly: primary admin > admin > manager > user.
- [ ] Seed/admin bootstrap controls reviewed for non-production leakage risk.
- [ ] Firm slug routing and tenant resolution validated.

## 3) Core module readiness

### CMS / intake
- [ ] Public/hosted/embed/API intake paths tested.
- [ ] Intake-to-lead conversion validated.
- [ ] Intake-to-client and intake-to-docket handoff validated where enabled.
- [ ] Idempotency/retry behavior verified for API intake.

### CRM
- [ ] Lead stage transitions tested (`new -> contacted -> qualified -> converted/lost`).
- [ ] Owner assignment and follow-up workflows validated.
- [ ] Client creation/update/search flows validated.

### Task Manager
- [ ] Docket create/view/update lifecycle verified.
- [ ] Workbasket, My Worklist, QC queue, and all-dockets flows validated.
- [ ] Assignment/reassignment rules verified against role expectations.
- [ ] Attachments and activity/history tabs validated.

### Reports
- [ ] Report pages load with pilot-size datasets.
- [ ] Export success/failure handling validated.

## 4) Security and compliance posture

- [ ] Environment validation passes (`npm run validate:env`).
- [ ] JWT/encryption/session configuration reviewed for pilot environment.
- [ ] Rate-limit and request-lifecycle protections active.
- [ ] Tenant isolation regression checks included in pre-pilot validation.
- [ ] Audit logging available for key admin/auth/docket operations.
- [ ] No unnecessary firm data replication beyond configured storage pathways.

## 5) BYOS and data ownership readiness

- [ ] Storage mode and ownership responsibilities communicated to pilot firm.
- [ ] Export/backup path tested (including failure handling).
- [ ] External storage integration (if enabled) validated for least-privilege configuration.
- [ ] Data lifecycle expectations documented (retention, deletion, offboarding expectations).

## 6) Reliability and operational readiness

- [ ] API + UI startup procedures documented for pilot support.
- [ ] Worker process enabled and monitored.
- [ ] Request ID propagation confirmed on critical paths.
- [ ] Monitoring and diagnostics endpoints secured (for example metrics token gating).
- [ ] Recovery playbooks available for auth failures, routing errors, and export/storage failures.

## 7) Release quality gates (pre-pilot)

Run before pilot cut:

```bash
npm run lint
npm run validate:env
npm run test
npm --prefix ui run build
npm --prefix ui run test:ci
```

- [ ] All commands pass in pilot target environment.
- [ ] Any temporary waivers are documented with owner + expiry date.

## 8) Pilot operations and support

- [ ] Pilot owner assigned (product + engineering).
- [ ] Support escalation path defined (severity, response SLA, rollback owner).
- [ ] First-week check-in cadence scheduled.
- [ ] Pilot feedback template ready (workflow friction, missing controls, trust concerns).

## 9) Go/No-Go decision

- [ ] **Go** only if sections 1–8 are complete or explicitly waived.
- [ ] All waivers recorded in pilot tracker with business rationale.

---

## Historical note

This checklist replaces older pilot support notes where scope was narrower or point-in-time diagnostics were emphasized.
