# Docket Detail API Contract (`GET /api/dockets/:caseId`)

## Stable DTO (new)
Response continues returning legacy `data.*` fields, and now includes:

- `data.docketDetail.docketId`
- `data.docketDetail.title`
- `data.docketDetail.description`
- `data.docketDetail.client` (`id`, `clientId`, `name`, `email`, `contact`, `isInternal`)
- `data.docketDetail.category` (`id`, `name`)
- `data.docketDetail.subcategory` (`id`, `name`)
- `data.docketDetail.lifecycle`
- `data.docketDetail.statusLabel`
- `data.docketDetail.assignee` (`xID`, `name`)
- `data.docketDetail.workbasket` (`id`, `name`)
- `data.docketDetail.dates` (`createdAt`, `updatedAt`, `dueDate`, `slaDueAt`, `pendingUntil`, `resolvedAt`, `filedAt`)
- `data.docketDetail.permissions`
- `data.docketDetail.availableActions` (when present)
- `data.docketDetail.attachmentsSummary` (`total`, `latestAt`)
- `data.docketDetail.timelineSummary` (`total`, `latestAt`)

## Backward compatibility
- Existing `data` top-level docket fields remain unchanged in this PR.
- Frontend should prefer `data.docketDetail` first and fallback to legacy fields.
