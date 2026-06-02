# Workbasket Capacity Intelligence

Workbasket Capacity Intelligence extends Docketra Intelligence from individual assignment guidance to queue-level capacity visibility.

## API

`GET /api/docketra-intelligence/workbasket-capacity`

Access is restricted to:

- `MANAGER`
- `ADMIN`
- `PRIMARY_ADMIN`

## Metrics

For every active primary workbasket, the API calculates:

- `memberCount`: active members assigned to the workbasket
- `openDockets`: active, non-terminal dockets in the workbasket queue
- `overdueDockets`: active dockets with an overdue due date
- `totalEstimatedHours`: total estimated hours from active docket expected effort
- `totalActualHours`: total actual hours logged on active dockets
- `averageAvailabilityScore`: average member availability from workload intelligence
- `capacityUtilization`: `100 - averageAvailabilityScore`
- `capacityLabel`: `Healthy`, `Busy`, or `Overloaded`

If a workbasket has active dockets but no assigned members, utilization is treated as `100%` so the queue is surfaced as overloaded risk. If it has no members and no active dockets, utilization is `0%`.

## Thresholds

Default thresholds:

- `Healthy`: utilization below `66%`
- `Busy`: utilization from `66%` to `85%`
- `Overloaded`: utilization `86%` and above

Optional query parameters allow threshold tuning:

- `busyThreshold`: integer from `1` to `100`
- `overloadedThreshold`: integer from `1` to `100`
- `includeQc`: boolean-like value to include QC workbaskets

`busyThreshold` must be lower than `overloadedThreshold`.

## Example Response

```json
{
  "success": true,
  "data": {
    "generatedAt": "2026-06-02T00:00:00.000Z",
    "thresholds": {
      "busy": 66,
      "overloaded": 86
    },
    "summary": {
      "totalWorkbaskets": 2,
      "healthy": 1,
      "busy": 1,
      "overloaded": 0
    },
    "workbaskets": [
      {
        "workbasketId": "67e95f7642adf77d7f4e1835",
        "name": "GST Team",
        "memberCount": 3,
        "openDockets": 12,
        "overdueDockets": 2,
        "totalEstimatedHours": 30,
        "totalActualHours": 27,
        "averageAvailabilityScore": 19,
        "capacityUtilization": 81,
        "capacityLabel": "Busy"
      },
      {
        "workbasketId": "67e95f7642adf77d7f4e1836",
        "name": "ROC Team",
        "memberCount": 4,
        "openDockets": 5,
        "overdueDockets": 0,
        "totalEstimatedHours": 12,
        "totalActualHours": 9,
        "averageAvailabilityScore": 58,
        "capacityUtilization": 42,
        "capacityLabel": "Healthy"
      }
    ]
  }
}
```

## Dashboard

The `Docketra Intelligence` dashboard includes a `Workbasket Health` section.

It renders capacity cards sorted by highest utilization first:

```text
GST Team
Capacity: 81%
Busy

ROC Team
Capacity: 42%
Healthy
```

Cards also show member count, open dockets, and overdue dockets for quick triage.
