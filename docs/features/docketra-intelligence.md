# Docketra Intelligence

Docketra Intelligence provides manager-facing operational signals for assignment and routing decisions.

## Workload Intelligence

`GET /api/docketra-intelligence/workload`

Access is limited to firm-scoped `MANAGER`, `ADMIN`, and `PRIMARY_ADMIN` roles.

The workload model avoids task-count-only scoring. It combines:

- Open dockets assigned to each user
- Priority pressure from urgent, high, medium, and low priority work
- Due dates, including due-today, due-this-week, and overdue work
- Review workload from reviewer and pending approval ownership
- Estimated hours from docket `expectedMinutes`
- Actual hours from `DocketEffort` entries on active dockets
- Hour overruns where actual hours exceed estimated hours

The API returns a 0-100 `availabilityScore` for every active firm member in scope. Higher means more available. It also returns a 0-100 `workloadScore`, where higher means heavier workload pressure.

Availability labels:

- `Available`: 75-100
- `Moderate`: 50-74
- `Busy`: 25-49
- `Overloaded`: 0-24

Optional query filters:

- `workbasketId`: limit scoring to members of a workbasket
- `assigneeXID`: inspect one assignee

Example response shape:

```json
{
  "success": true,
  "data": {
    "generatedAt": "2026-06-02T00:00:00.000Z",
    "summary": {
      "totalMembers": 4,
      "available": 1,
      "moderate": 2,
      "busy": 1,
      "overloaded": 0
    },
    "recommendations": {
      "recommendedAssignee": {
        "xID": "X100001",
        "name": "Team Member",
        "availabilityScore": 82,
        "availabilityLabel": "Available"
      },
      "bestAssignees": [],
      "avoidAssigning": []
    },
    "members": []
  }
}
```

## Recommendation Usage

AI routing suggestions now use the same workload score when a suggested workbasket is available. Manager and above users receive `assigneeRecommendations` in the routing suggestion payload, ranked by availability score first and then by overdue, review, and active docket pressure.

## Manager Dashboard

The firm workspace includes a `Docketra Intelligence` dashboard for `MANAGER`, `ADMIN`, and `PRIMARY_ADMIN` users at `/app/firm/:firmSlug/docketra-intelligence`.

Navigation:

- The sidebar shows `Docketra Intelligence` below `Workbaskets`.
- The item uses a brain/insights style icon.
- Users below `MANAGER` do not see the navigation item and are redirected by the protected route guard.

Dashboard sections:

- `Team Capacity Overview`: shows total members and the Available, Moderate, Busy, and Overloaded buckets from `GET /api/docketra-intelligence/workload`.
- `Recommended Assignment Card`: shows the recommended assignee, availability score, availability label, and the helper line `Best person to receive the next assignment`.
- `Team Availability Table`: lists employee name, availability score, availability label, workload score, open dockets, overdue, due today, review queue, estimated hours, and actual hours. Rows are sorted by availability score descending.
- `Assignment Guidance`: renders ranked `Best Assignees` and `Avoid Assigning` cards from the recommendation payload.

The dashboard includes loading, empty, and error states and uses the existing platform shell, section, stat row, data table, badge, and feedback components.
