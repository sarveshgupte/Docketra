# Docketra Beta Launch Readiness Audit (May 2026)

## Findings
- Tenant isolation posture is generally strong in tenant-scoped endpoints; most controllers already include `firmId`/`tenantId` in lookup filters.
- Two high-risk object-ID lookup paths used `_id` without tenant scope checks in controller query filters.
- Task/query traffic patterns lacked a few tenant-first compound indexes for worklist/report filters.
- Refresh token lookup paths had unique `tokenHash`, but lacked a compound security lifecycle index including revocation and expiry.

## Fixed issues
1. **AI attachment controller hardening**
   - Updated attachment reads to query by `{ _id, firmId }` when firm context is present, preventing cross-tenant object-ID probing.
2. **Team assignment hardening**
   - Updated team user assignment path to include `firmId` directly in `User.findOne(...)`, eliminating cross-tenant user object hydration before post-check.
3. **Performance/index hardening**
   - Added `Task` indexes for tenant assignment queues, due-date reporting, and client-filtered worklist/report access.
   - Added `File` index for tenant-status-recency access pattern used by file listing/reporting.
   - Added `RefreshToken` compound index on `tokenHash + isRevoked + expiresAt` for revocation/expiry-aware token lifecycle queries.
4. **Regression tests**
   - Added targeted regression test ensuring hardened controller query shapes include tenant scope for attachment AI insights and team assignment.

## Remaining risks / follow-up
- Full route-by-route cross-tenant denial integration suite (dockets/tasks/clients/files/reports/users/categories) should be expanded with authenticated HTTP-level tests against mounted routes.
- Query-shape/perf tests for dashboard/worklist/search/reports should be extended to explicit `explain()`-verified plans in CI against seeded datasets.
- Run a full CI release gate in a production-like environment with MongoDB and Redis available to validate all route-level boundary expectations.

## Manual production smoke checklist
- [ ] Log in as Firm A admin/user and create docket/task/client/file/report artifacts.
- [ ] Attempt direct ObjectId access to Firm B artifacts via URL and API body IDs; verify 404/403 across read/update/delete/download/route operations.
- [ ] Verify worklist, dashboard, and reports load within acceptable latency at production-like dataset scale.
- [ ] Validate file upload/download lifecycle across configured storage provider with tenant segregation.
- [ ] Validate refresh-token rotation/revocation/login logout flows under concurrent sessions.
- [ ] Confirm audit logs include tenant context for security-sensitive actions.
- [ ] Verify optional AI-disabled mode still preserves docket/file flows without failures.
