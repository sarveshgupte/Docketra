# What's New

## Workflow + RBAC Core Architecture Upgrade

### Multi-workbasket user support
- Users can now be assigned to multiple workbaskets using `teamIds` (workbasket access list), while retaining a primary basket in `teamId`.
- New `GET /api/self/core-work` endpoint returns the current user's active workbaskets in the `[{ id, name, type }]` shape for multi-WB UI rendering.

### QC workbasket system
- Workbasket model now supports `type` (`PRIMARY`/`QC`) and `parentWorkbasketId` to represent explicit QC lanes.
- Creating a primary workbasket now auto-creates a paired QC workbasket (`<name> - QC`).
- Docket workflow transition to QC now attempts to route into the mapped QC workbasket for the current primary basket.

### Manager-based assignment control
- Workbasket management and user-to-workbasket assignment routes are now gated to `MANAGER` and `PRIMARY_ADMIN`.
- Introduced firm permission `WORKBASKET_MANAGE` and granted it to manager + primary admin roles only.
- Admins keep category/client management capability but are blocked from workbasket assignment operations.

### Strict routing + validation improvements
- Subcategories now require `workbasketId` mapping at data-model and request-validation levels.
- Subcategory create/update now validates that referenced workbasket is an active primary workbasket in the same firm.
- Case creation now routes to the subcategory-mapped workbasket and falls back to default active primary workbasket only when no subcategory mapping is involved.

### Client-level access readiness
- User model now includes `clientAccess` array support for explicit client-level allow-listing and response mapping.

### Operational guardrails
- Workbasket listing now returns a warning when no users are assigned:
  - `"No users assigned to this workbasket"`

## April 2026: Platform UI/UX Productivity Refresh

- Upgraded firm platform shell with improved sidebar grouping, sticky topbar clarity, and consistent primary actions.
- Added reusable platform UI primitives for page sections, filters, notices, metric grids, and resilient tables.
- Improved daily execution surfaces (My Worklist, Workbaskets, QC Queue) with filter/search, refresh controls, and better loading/empty/error states.
- Refined Dashboard, Reports, CRM, CMS Intake, and Settings pages for stronger information hierarchy and faster scanning.
- Standardized visible workflow terminology around **Docket** for better enterprise consistency and trust.

### April 2026: Platform UX refinement pass

- Topbar actions are now page-owned (no hardcoded shell actions), improving context clarity.
- Platform tables now include lightweight pagination with Previous/Next controls.
- Filter bars now include a consistent "Clear filters" action.
- Action layouts are standardized: primary entry first, secondary actions grouped, destructive actions visually distinct.
- Inline success notices were added to key queue actions (Worklist, Workbaskets, QC) for faster operator feedback.
- Accessibility improved with focus-visible styling and better disabled-state handling for controls.
