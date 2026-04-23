# Slow screen triage

## Docket detail
- Filter logs for `DOCKET_DETAIL_LOAD` and compare `durationMs` percentiles.
- Correlate with frontend `route_transition`, `slow_api_response`, `request_duration` events.

## Client detail / CFS
- Use `CLIENT_DETAIL_LOAD` + `CLIENT_FACT_SHEET_MUTATION` events.
- Check for repeated `duplicate_api_request` warnings indicating stale refresh loops.

## Route regressions
- Compare transition durations between `/dashboard`, `/dockets/:id`, `/clients/:id`, `/reports`.
- Large jumps with normal backend duration often indicate frontend hydration/rendering overhead.

## Noise controls
- Duplicate warnings and slow warnings are deduped with TTL windows.
- Only operations above threshold emit warnings; normal events are informational.
