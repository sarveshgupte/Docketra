# Worklist navigation, scoped load, and storage popover hotfix (May 2026)

## Symptoms
- On `/app/firm/:firmSlug/worklist?workbasketId=...`, multiple Worklists sidebar links could show active simultaneously because links share the same pathname.
- Assigned worklist could show a load error banner for non-admin users despite valid scoped access when users were linked through `user.workbaskets` but not `teamId/teamIds`.
- Storage status popover could overflow horizontally with long connected account/location text and cramped metadata/action layout.

## Root cause
- Nav active evaluation combined path-only and query-aware match checks, so query-scoped links were still path-matched.
- Scoped worklist authorization for non-admin users validated only team membership (`teamId/teamIds`) and did not include explicit linked workbasket memberships (`user.workbaskets`).
- Storage popover and metadata grid lacked stricter viewport and min-content constraints for long unbroken strings.

## Fix
- Enforced `exactWithQuery` behavior so query-scoped links only activate on exact `pathname + search` match.
- Updated sidebar active predicate to use query-aware location matching as the single source for active state.
- Kept existing workbasket authorization model but expanded non-admin membership resolution to include `user.workbaskets` IDs in permitted scoped workbasket checks.
- Strengthened storage popover CSS with viewport-safe max width, `minmax(0, 1fr)` metadata value column, min-width safeguards, and wrapping for action links/text.

## Tests
- Updated sidebar regression checks to assert exact query-mode handling and prevent broad pathname fallback for query-scoped items.
- Extended scoped authorization regression to validate non-admin access when linked via `user.workbaskets`, while retaining invalid/unknown/unauthorized safeguards.
- Extended storage badge regression checks for viewport-safe width and wrapping/stacking CSS rules.

## Manual verification checklist
1. Login as a user with multiple assigned workbaskets and open `/app/firm/<firm>/worklist?workbasketId=<id>`.
2. Confirm exactly one Worklists child link is active for the selected `workbasketId`.
3. Switch between workbasket links and verify active state follows query param exactly.
4. Confirm Workbaskets overview active state does not collide with Worklists query-scoped links.
5. For non-admin user linked to workbasket via assignment, verify `/api/worklists/employee/me?workbasketId=<id>` returns `200` with items or empty list.
6. Verify invalid `workbasketId` returns `400` and unknown/cross-firm `workbasketId` returns `404`.
7. Verify authorized empty scoped workbasket returns `200` and UI shows empty state (not red error banner).
8. Open storage status popover with long connected email/location values and verify no horizontal overflow.
9. Resize viewport to tablet/mobile widths and verify metadata rows stack and action links wrap while remaining clickable.
