# Docketra Welcome + Tutorial + What's New Reference

## Purpose
This document defines the first-login onboarding experience and the product-updates modal flow so future feature work can keep tutorials and release messaging aligned.

## 1) First-login welcome tutorial

### Trigger
- Returned by `GET /api/auth/profile` as `data.welcomeTutorial`.
- Modal shows when `welcomeTutorial.show === true`.
- Current backend rule: `show = !user.tutorialCompletedAt`.

### Audience variants
- **Admin tutorial**
  1. Review dashboard and invite team members.
  2. Configure categories/work types/firm settings.
  3. Create first docket workflow and assign ownership.
- **User tutorial**
  1. Open worklist and review assigned dockets.
  2. Update docket status + add comments.
  3. Use search/filters to find work quickly.

### Completion behavior
- Frontend calls `PATCH /api/users/tutorial/complete`.
- Backend sets `tutorialCompletedAt`.
- Tutorial modal is not shown again for that user.

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
