# Admin Settings Suitability Review (Web App)

Date: 2026-04-04
Updated: 2026-04-04 (implementation follow-up completed)

## Scope reviewed
- Sidebar admin settings entry points.
- Route-level admin authorization.
- Admin-facing settings pages and their current feature coverage.

## Current admin settings inventory

### 1) Admin sidebar entry points
The admin section currently exposes four links:
- Team Management
- Firm Settings
- Work Settings
- Storage Settings

These are visible only when `hasAdminAccess` is true in layout logic.

### 2) Route protection and authorization
The following firm routes are gated with `requireAdmin`:
- `/settings/firm`
- `/settings/work`
- `/storage-settings`
- `/admin`
- `/admin/reports`
- `/admin/reports/detailed`

This is suitable for preventing non-admin access in the UI layer.

### 3) Firm Settings page (`/settings/firm`)
Current features:
- Operational numeric defaults:
  - SLA default days
  - Escalation inactivity threshold (hours)
  - Workload threshold
- Feature toggles:
  - Performance View
  - Escalation View
  - Bulk Actions
- Save feedback and unsaved-change affordance.
- Storage settings are managed on the dedicated `StorageSettingsPage` (OTP + provider switching + connection test).
- Recent user activity panel (derived from recent case/audit activity).

### 4) Work Settings page (`/settings/work`)
Current features:
- Work assignment strategy
- Workflow strictness mode
- Auto-assignment toggle
- High-priority SLA days and due-soon warning days
- Category Management shortcut

### 5) Admin page settings-related capabilities
Current capabilities include:
- User management (create user, status actions, invite resend, password reset, unlock).
- Client access restrictions per user.
- Category/subcategory management (create, toggle active/inactive, delete).

Storage settings are now centralized in the dedicated `StorageSettingsPage` path.

## Suitability assessment

## Overall verdict: **Suitable (after implementation updates)**

The current admin settings implementation now uses a server-backed firm/work settings model with auditable updates, a unified storage settings surface, and explicit settings IA navigation links across settings pages.

## Strengths
- Clear role-based route guarding for admin-only settings pages.
- Basic operational defaults and feature toggles exist for firm-level behavior.
- Work taxonomy management is available (categories/subcategories).

## Remaining gaps and risks
1. **Read-side propagation**
   - Some read paths still rely on local `firmConfig` cache for operational defaults.
   - Full global hydration from server settings for all roles can be a follow-up hardening item.

## Implementation status (all recommendations)
1. **Storage settings unified**
   - Removed duplicate storage settings surface from `AdminPage`.
   - Retained dedicated `StorageSettingsPage` as the canonical surface.
   - Added explicit Storage Settings entry in admin sidebar.

2. **Work Settings expanded**
   - Added editable operational work controls and save flow.
   - Kept category management shortcut.

3. **Server-backed persistence**
   - Added persisted `settings.firm` and `settings.work` to firm model.
   - Added `GET/PUT /api/admin/firm-settings` endpoints.
   - Firm/Work pages now load from and save to server.

4. **Settings IA pass**
   - Added consistent quick-link IA controls across settings pages:
     - Firm, Work, Storage, Security, Audit.

5. **Auditable settings changes**
   - Added admin audit logging for firm/work settings updates with previous and next values.
