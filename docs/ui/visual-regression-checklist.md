# Docketra Visual Regression Checklist

## Purpose

Use this checklist in every low-risk UI PR that updates design tokens, shared layout contracts, or component styling. The goal is to catch visual drift early without changing product behavior.

## How to use this checklist

1. Run through section **A** (shared primitives) first in Storybook-equivalent surfaces or nearest in-app usage.
2. Validate section **B** (high-traffic screens) in a realistic role-aware workspace.
3. Validate section **C–E** states while interacting with real controls (search, filter, save, modal flows).
4. Log outcomes in the PR using this format:
   - `PASS` / `ISSUE` / `N/A`
   - screenshot or short note
   - route + role used

---

## A) Shared primitives QA matrix

### Button
- [ ] Primary
- [ ] Secondary
- [ ] Outline
- [ ] Danger
- [ ] Ghost
- [ ] Disabled
- [ ] Loading (spinner/text remains readable)

Checks:
- [ ] Focus ring visible with keyboard navigation.
- [ ] Disabled state is readable and clearly non-interactive.
- [ ] Destructive action styles remain visually distinct.

### Input / Select / Textarea
- [ ] Normal
- [ ] Focus
- [ ] Disabled
- [ ] Read-only
- [ ] Error
- [ ] Success
- [ ] Help text

Checks:
- [ ] Label-control association remains correct.
- [ ] Error + success states are not color-only (message/icon/copy present).
- [ ] Placeholder and helper text remain readable.

### Badge
- [ ] Success
- [ ] Warning
- [ ] Danger
- [ ] Info
- [ ] Neutral

Checks:
- [ ] Badge text contrast remains acceptable.
- [ ] Semantic meanings still match product meaning.

### Card
- [ ] Standard card
- [ ] Interactive card (hover/focus)
- [ ] Card footer/actions

Checks:
- [ ] Card elevation/border tokens are consistent.
- [ ] Interactive states do not imply clickability where none exists.

### Modal
- [ ] Header
- [ ] Content
- [ ] Actions
- [ ] Close button
- [ ] Overlay
- [ ] Focus trap

Checks:
- [ ] Escape/close behavior unchanged.
- [ ] Initial focus and tab loop stay within modal.
- [ ] Overlay and dialog contrast remain clear.

### Table / DataTable
- [ ] Header
- [ ] Dense rows
- [ ] Empty state
- [ ] Error state
- [ ] Retry action
- [ ] Active filters
- [ ] Pagination
- [ ] Row focus state

Checks:
- [ ] Row height remains operationally dense.
- [ ] Sorting/filtering affordances remain readable.
- [ ] Loading/refresh messaging does not overlap controls.

### Other shared primitives
- [ ] EmptyState
- [ ] StatusMessageStack / inline notices
- [ ] PageHeader
- [ ] PlatformShell sidebar/topbar

Checks:
- [ ] Status priority remains clear (error > warning > info > success).
- [ ] Shell density remains compact and scannable.

---

## B) High-traffic screens route checklist

> Use a firm slug placeholder (`:firmSlug`) and role-appropriate account. Mark each as PASS/ISSUE/N/A.

| Route path | Screen | Primary module | Priority |
|---|---|---|---|
| `/login` | Login | Public auth | P0 |
| `/signup` | Signup/workspace creation | Public onboarding | P1 |
| `/app/firm/:firmSlug/dashboard` | Dashboard | Platform core | P0 |
| `/app/firm/:firmSlug/dockets` | All Dockets | Dockets | P0 |
| `/app/firm/:firmSlug/my-worklist` | My Worklist | Work queues | P0 |
| `/app/firm/:firmSlug/global-worklist` | Workbench | Work queues | P0 |
| `/app/firm/:firmSlug/qc-queue` | QC Workbench | Work queues | P0 |
| `/app/firm/:firmSlug/crm/leads` | CRM leads | CRM | P1 |
| `/app/firm/:firmSlug/crm/clients/:crmClientId` | CRM client detail | CRM | P1 |
| `/app/firm/:firmSlug/cms` | CMS form management | CMS | P1 |
| `/app/firm/:firmSlug/cms` (intake queue section) | CMS intake queue | CMS | P1 |
| `/app/firm/:firmSlug/task-manager` | Task Manager | Platform module | P1 |
| `/app/firm/:firmSlug/admin/reports` | Reports | Reporting | P1 |
| `/app/firm/:firmSlug/admin?tab=users` | Admin users | Admin | P1 |
| `/app/firm/:firmSlug/admin?tab=clients` | Admin clients | Admin | P1 |
| `/app/firm/:firmSlug/admin?tab=categories` | Admin categories | Admin | P1 |
| `/app/firm/:firmSlug/settings/firm` | Firm settings | Settings | P0 |
| `/app/firm/:firmSlug/settings/work` | Work settings | Settings | P1 |
| `/app/firm/:firmSlug/storage-settings` | Storage/BYOS settings | Settings | P0 |
| `/app/firm/:firmSlug/ai-settings` | AI/BYOAI settings | Settings | P0 |
| `/upload/:token` | Public upload | Public intake | P0 |
| `/forms/:formId` | Public/embedded intake form | Public intake | P0 |
| `/app/superadmin` | Superadmin dashboard | Superadmin | P1 |
| `/app/superadmin/onboarding-insights` | Superadmin onboarding insights | Superadmin | P2 |

---

## C) Interaction state checklist

- [ ] Loading
- [ ] Background refresh
- [ ] Empty state
- [ ] Filtered empty state
- [ ] Validation error
- [ ] API error
- [ ] Success toast/status
- [ ] Disabled action
- [ ] Destructive confirmation
- [ ] Modal open/close
- [ ] Keyboard focus traversal
- [ ] Responsive wrapping (tablet/mobile widths)

---

## D) Accessibility checks

- [ ] Focus states are visible and predictable.
- [ ] Disabled states are readable (not overly faint).
- [ ] Semantic meaning is not color-only.
- [ ] Modal focus trap still works.
- [ ] Tables remain keyboard accessible where applicable.
- [ ] Form labels are associated with controls.
- [ ] Semantic badges/notices have acceptable contrast.

---

## E) Density checks

- [ ] Table rows did not become too tall.
- [ ] Filter bars still support operational workflows.
- [ ] Settings forms remain scannable.
- [ ] CRM/CMS lists are not too airy.
- [ ] Sidebar/topbar remain compact and useful.

---

## Lightweight regression guidance for token/layout PRs

- Keep visual-only PRs visual-only: no API, RBAC, auth, route, payload, or workflow changes.
- Prioritize P0 routes from section B for manual QA before merge.
- Compare before/after screenshots for:
  - one dense table page,
  - one form-heavy settings page,
  - one modal flow,
  - one public page (`/upload/:token` or `/forms/:formId`).
- If a hardcoded color is discovered during QA, replace only that token-safe value and re-run this checklist.

## Automated regression status (current)

Docketra currently has route and design-system contract script tests (`ui/tests/*.test.mjs`) but does not yet maintain baseline screenshot snapshots. Visual regression remains a manual checklist gate in this phase to keep PR risk and tooling overhead low.
