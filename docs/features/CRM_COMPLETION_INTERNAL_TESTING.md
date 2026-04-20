# CRM Completion for Internal Testing

## Scope

This update makes the CRM module operational for real admin/manager daily testing without changing route architecture or redesigning the product.

## What Was Fixed

### 1) API contract alignment (invoice mark-paid)

- Standardized active frontend contract to `PATCH /api/invoices/:id/paid`.
- Added backend support for both:
  - `PATCH /api/invoices/:id/paid` (canonical)
  - `PATCH /api/invoices/:id/pay` (legacy compatibility)
- Added schema validation coverage for both paths.

### 2) CRM Clients workspace hardening

- Added operational filters:
  - Search
  - Type filter
  - Status filter
  - Tag filter
  - Lead source filter
- Added edit workflow in modal (`PATCH /api/crm-clients/:id`).
- Added archive/deactivate action (`PATCH /api/crm-clients/:id/deactivate`) instead of delete.
- Kept loading/error/empty states and improved active-filter awareness.
- Added duplicate-submit and blank-name protection in create/edit submit path.

### 3) Leads workflow completion

- Preserved full lead lifecycle:
  - Create lead
  - Assign owner
  - Next follow-up
  - Last contact
  - Notes
  - Stage transition
  - Convert to client
- Improved reliability of recent activity in manage modal by keeping selected lead state synchronized after updates/conversion.
- Kept optimistic update only in quick stage update with rollback on failure.

### 4) CRM client detail workspace reliability

- Deal creation validation:
  - Required title
  - Numeric non-negative value check
- Invoice creation validation:
  - Numeric non-negative amount required
- Invoice mark-paid now patches local state + summary immediately after success.
- Existing linked docket rendering and navigation paths preserved.

### 5) Removed misleading/dead-end CRM action

- Removed `Import Clients (CSV)` CTA from CRM Clients quick actions because no working implementation existed.

## Operator Workflow Now Supported

Admin/manager can now reliably:

1. Create lead.
2. Assign/update owner and follow-up details.
3. Add notes and change stage.
4. Convert lead to client.
5. Open client workspace.
6. Create deal.
7. Create invoice.
8. Mark invoice as paid.

## Intentionally Deferred Capabilities

- CSV client import implementation (deferred; CTA removed to prevent dead-end flow).
- Bulk CRM operations and advanced segmentation/reporting were not introduced in this patch.

## Backward Compatibility Notes

- Legacy invoice route `/:id/pay` remains supported to avoid breaking older callers.
- Existing CRM route structure was not changed.
