# Deadline Risk Intelligence

Deadline Risk Intelligence surfaces deadline exposure across active dockets so managers can intervene before statutory, internal, or review deadlines slip.

## API

`GET /api/docketra-intelligence/deadline-risk`

Access is restricted to:

- `MANAGER`
- `ADMIN`
- `PRIMARY_ADMIN`

## Signals

The endpoint calculates:

- `overdueDockets`: active dockets with a primary due date before today
- `dueToday`: active dockets due today
- `dueThisWeek`: active dockets due from today through the next seven days
- `highPriorityDueThisWeek`: urgent or high-priority active dockets due this week
- `reviewBottlenecks`: active dockets waiting in review/QC/submitted states or pending approval

Primary due date is resolved from the earliest available date among internal due date, statutory due date, SLA due date, docket due date, and approval due date.

## Risk Levels

The API returns one of:

- `Low Risk`
- `Medium Risk`
- `High Risk`
- `Critical`

Risk is deterministic and explainable:

- `Critical`: major overdue load, overdue plus review bottlenecks, or extreme high-priority near-term pressure
- `High Risk`: any overdue docket, heavy due-today load, multiple high-priority dockets due this week, or review bottleneck concentration
- `Medium Risk`: due-today, due-this-week, high-priority, or review signals exist but are not yet severe
- `Low Risk`: no immediate deadline pressure

## Response Shape

```json
{
  "success": true,
  "data": {
    "generatedAt": "2026-06-02T00:00:00.000Z",
    "riskLevel": "Critical",
    "recommendedAction": "Reassign work immediately.",
    "affectedDocketCount": 17,
    "counts": {
      "overdueDockets": 12,
      "dueToday": 1,
      "dueThisWeek": 6,
      "highPriorityDueThisWeek": 4,
      "reviewBottlenecks": 5
    },
    "affectedDockets": [],
    "radar": [
      { "label": "Overdue Dockets", "value": 12 },
      { "label": "Due Today", "value": 1 },
      { "label": "Due This Week", "value": 6 },
      { "label": "High Priority Due This Week", "value": 4 },
      { "label": "Review Bottlenecks", "value": 5 }
    ]
  }
}
```

## Dashboard Widget

The `Docketra Intelligence` dashboard includes a `Deadline Risk Radar` widget.

It displays:

- Risk level
- Affected docket count
- Overdue docket count
- Review bottleneck count
- Due today
- Due this week
- High priority due this week
- Recommended action

Example:

```text
Critical
12 overdue dockets
5 awaiting review approval

Recommendation:
Reassign work immediately.
```
