# Subcategory SOP / Work Instructions

This feature adds lightweight SOP/work-instruction support at **subcategory** level.

## Scope
- CFS remains **client-specific reference data**.
- SOP is **work-type/subcategory-specific instructions**.
- SOP is snapshotted into dockets at creation time.

## Data model
- `Category.subcategories[].sop`
  - `title` (default `''`, max 200)
  - `body` (default `''`, max 10000)
  - `format` (`plain_text` | `markdown`, default `plain_text`)
  - `lastUpdatedAt`
  - `lastUpdatedByXID`
- `Case.sopSnapshot`
  - `title`, `body`, `format`
  - `sourceSubcategoryId`
  - `capturedAt`

## Behavior
When creating a docket from a category/subcategory:
- If subcategory SOP has a title or body, a snapshot is copied into `Case.sopSnapshot`.
- Snapshot is immutable historical payload for that docket.
- Later changes to Category SOP do not mutate existing docket snapshots.

Docket detail serializer exposes SOP as read-only payload:
- `sop.title`
- `sop.body`
- `sop.format`
- `sop.capturedAt`

## Explicit non-goals in this PR
- No rich editor.
- No AI SOP generation.
- No reminders or recurrence.
- No SOP version history.

## Docket Detail read-only visibility

Docket Detail now renders the captured SOP snapshot (title, body, format, and captured timestamp when available) as a read-only section so assignees can follow work instructions without editing category configuration.



## SOP reference links
- Subcategory SOP now supports text + multiple reference links (`title`, `url`, `description`, `type`, `sortOrder`).
- On docket creation, SOP links are snapshotted into `sopSnapshot.links` and remain immutable for that docket.
- File/attachment support is intentionally out of scope in this phase.
