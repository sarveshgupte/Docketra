# Worklist + Sidebar Regression (May 2026)

## Incident
- Production worklist route `/app/firm/:firmSlug/worklist?workbasketId=...` showed load failure banner.
- Sidebar showed raw SVG/path fragments (`p="round"`, `d="M21...`) instead of icons.

## Root cause
1. **Worklist API request validation mismatch**
   - Frontend passed `workbasketId` to `GET /api/worklists/employee/me` for scoped worklist view.
   - Backend schema used strict query validation and rejected unknown keys; `workbasketId` was missing in schema.
2. **Sidebar icon regression**
   - Navigation constants stored icons as raw SVG strings.
   - Sidebar rendered `item.icon` as React children, so strings were displayed literally.

## Fix
- Added `workbasketId` to `GET /employee/me` schema and implemented server-side workbasket filtering in employee worklist query.
- Added permission guard for scoped `workbasketId` using firm-scoped Team (workbasket) lookup:
  - Validate ObjectId, then load active workbasket by `{ _id, firmId }`; return 404 if absent (including cross-firm ids).
  - Admin/Primary Admin can scope by any firm workbasket.
  - Non-admin users must have membership via `teamId/teamIds` to the workbasket team id (or QC parent linkage via `parentWorkbasketId`).
- Replaced raw SVG strings with React icon nodes in platform navigation constants.

## Verification
- Added regression test `ui/tests/worklistSidebarRegression.test.mjs`.
- Ran related queue/navigation tests, schema regression check, and scoped workbasket authorization regression check.

## Deployment/cache note
- Because sidebar icon regression was frontend bundle-related, deploy the new UI bundle and invalidate CDN/edge cache for app JS assets before traffic cutover.
