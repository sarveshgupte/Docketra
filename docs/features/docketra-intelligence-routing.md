# Docketra Intelligence Routing

Docket assignment surfaces use Docketra Intelligence to guide managers without blocking manual choice.

## Assignment Workflow

When a `MANAGER`, `ADMIN`, or `PRIMARY_ADMIN` assigns or reassigns a docket, the UI calls:

`GET /api/docketra-intelligence/workload`

The response is matched against selectable assignees by `xID`, user id, or email. Assignment remains manual and optional: if intelligence data is loading or unavailable, the assignee dropdown still works.

## Assignee Indicators

Each assignee option is enriched with:

- Availability score
- Availability label: `Available`, `Moderate`, `Busy`, or `Overloaded`
- Open docket count
- Overdue count
- Recommended marker when Docketra Intelligence identifies the best assignee

Example display:

```text
John Doe
Availability: 82
Available
3 Active Dockets
0 Overdue
```

## Sorting

Assignment dropdowns and guidance cards sort assignees by:

- `availabilityScore` descending
- `overdue` ascending
- `reviewQueue` ascending

Name is used only as the final deterministic tie-breaker.

## Recommendation Tooltip

Recommended assignee cards expose this tooltip:

```text
Recommendation is based on active workload, due dates, review commitments, estimated effort and actual effort.
```

## Current UI Coverage

Docketra Intelligence is applied to:

- Platform Workbaskets bulk move to worklist
- Platform Worklist bulk reassignment
- Case Detail move docket to another worklist modal

These surfaces highlight the recommended assignee, show ranked workload context beside the selector, and preserve manual selection.
