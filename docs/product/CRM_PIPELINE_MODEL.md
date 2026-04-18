# CRM Pipeline Model (Docketra)

This document defines the conservative CRM pipeline lifecycle introduced for lead operations.

## Lifecycle stages

1. `new`
   - Lead has been created from CMS/public/embed/manual/API intake.
   - Initial ownership and first follow-up can be set.

2. `contacted`
   - Team has made first outreach.
   - `lastContactAt` should typically be set.

3. `qualified`
   - Lead has been vetted and is suitable for conversion.
   - Keep qualification context in notes/activity.

4. `converted`
   - Lead has been converted into a canonical client.
   - `convertedAt` and `convertedClientId` are persisted.
   - CRM can show downstream execution readiness/work state.

5. `lost`
   - Lead did not convert.
   - `lostReason` can be captured for reporting and learning.

## Data model expectations

Lead records now support lightweight pipeline operations while preserving backward compatibility:
- `stage` + backward-compatible `status`
- `ownerXid` (nullable)
- `nextFollowUpAt`
- `lastContactAt`
- `convertedAt`
- `convertedClientId`
- `lostReason`
- `notes[]` and `activitySummary[]`

Older records without these fields continue to work safely.

## Activity timeline scope

This is intentionally lightweight and embedded on lead records for this phase.
Typical entries:
- lead created
- stage changed
- owner changed
- follow-up updated
- note added
- converted/lost

## Module handoff alignment

Docketra operating flow remains:

`CMS -> CRM -> Tasks`

- **CMS** captures demand from forms/intake channels.
- **CRM** qualifies, assigns, follows up, and converts leads.
- **Tasks** executes downstream docket work once a client is ready.

This keeps the acquisition-to-execution lifecycle visible without introducing heavy sales-suite complexity.
