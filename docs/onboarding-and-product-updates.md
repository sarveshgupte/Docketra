# Docketra Welcome + Tutorial + What's New Reference

## Purpose
This document defines the first-login onboarding experience and the product-updates modal flow so future feature work can keep tutorials and release messaging aligned.

## 1) First-login welcome tutorial

### Trigger
- Returned by `GET /api/auth/profile` as `data.welcomeTutorial`.
- Modal shows when `welcomeTutorial.show === true`.
- Current backend rule: show only when tutorial status is `pending` (no `tutorialCompletedAt`, no `tutorialState.completedAt`, and no `tutorialState.skippedAt`).

### Audience variants
- **Superadmin tutorial**: platform oversight + tenant support controls.
- **Primary Admin tutorial**: full workspace setup ownership and hierarchy rollout.
- **Admin tutorial**: operational setup + docket flow support under primary admin.
- **Manager tutorial**: queue throughput, QC handoff, and allocation control.
- **User tutorial**: assigned execution workflow and clean handoff discipline.

### Completion behavior
- Frontend calls `PATCH /api/users/tutorial/complete` with optional `status`, `role`, and `stepIndex`.
- Backend updates `tutorialState` (seen/skipped/completed metadata) and keeps `tutorialCompletedAt` for backward compatibility.
- Tutorial remains dismissible and replayable manually from dashboard Help & Onboarding. Manual replay does not call persistence APIs.

## 2) What's New / Product Updates system

### Data model
Collection: `product_updates` (`ProductUpdate` model)
- `title: String`
- `content: String[]` (1-5 bullets)
- `isPublished: Boolean`
- `createdAt: Date`
- `createdBy: String`
- Optional: `version`, `updateKey`

User model additions:
- `lastSeenUpdateId: String | null`
- `tutorialCompletedAt: Date | null`

### API endpoints
- `POST /api/product-updates` (superadmin only)
- `GET /api/product-updates/latest`
- `GET /api/product-updates` (optional changelog foundation)
- `PATCH /api/users/mark-update-seen`
- `PATCH /api/users/tutorial/complete`

### Auth/profile contract
`GET /api/auth/profile` returns:
- `welcomeTutorial`: show/role/steps
- `whatsNew`:
  - `show = user.lastSeenUpdateId !== latestPublishedUpdate._id`
  - `update = latestPublishedUpdate | null`

### UX behavior
- Tutorial modal is shown before What's New.
- What's New modal title: **What’s New 🚀**
- Dismiss action: **Got it**
- Dismiss calls `PATCH /api/users/mark-update-seen`.
- Modal shows only once per user per update.
- Only the latest published update is considered.

## 3) Update process for future features
When adding features that affect onboarding or release notes:
1. Update tutorial steps in backend profile response logic.
2. Update this document (audience steps + API/contract changes).
3. Ensure superadmin release-note copy is short and value-focused (3-5 bullets).
4. Keep modal non-intrusive and dismissible.

## 4) Setup checklist trust upgrade (data-driven progress)

### Why
The previous checklist could be advanced by local UI state even when real workspace setup was incomplete.

### What changed
- Added backend progress endpoint: `GET /api/dashboard/onboarding-progress`.
- Checklist completion now defaults to backend-detected truth from firm/client/category/workbasket/docket/user workflow data.
- Manual completion remains only as a fallback for non-detectable steps.
- Checklist item metadata now includes `source` and `explanation` to improve credibility.

### UX impact
- Users now see concise, actionable explanations for incomplete steps (for example, waiting on first client, pending workbasket assignment, or unassigned queue routing).
- Incomplete steps provide direct role-safe CTAs to the right page.
- Recent dockets empty state now references onboarding gaps for admin roles (missing clients or missing category/workbasket setup).

- Optional onboarding progress fetch is non-blocking and cannot fail core dashboard metrics/recent dockets rendering.
- For detected steps, backend status is authoritative; CTA clicks do not force manual completion.
