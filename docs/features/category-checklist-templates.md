# Subcategory Checklist Templates

This feature adds lightweight checklist templates at **subcategory** level in Category Management.
Current implementation scope is **backend + API validation + serializer response** (no full admin checklist editor UI yet).

## Scope
- Templates are stored in `Category.subcategories[].checklistTemplate`.
- New dockets get a **snapshot** copied into `Case.checklist` at create time.
- Existing dockets are not mutated when templates change.
- Existing subcategory `deadlineRule` support remains fully supported for add/update flows.

## Non-goals in this PR
- No recurrence engine.
- No reminder system.
- No government integrations.
- No workflow engine redesign.

## Data model
- `checklistTemplate` on subcategory defaults to `[]` for backward compatibility.
- `checklist` on docket/case defaults to `[]`.

## Snapshot behavior
At docket creation time, each template item is copied with:
- title, description, required, sortOrder
- completed=false
- templateItemId from template item id
- assignedToXID from `defaultAssigneeXID` (if provided)
- dueDate from `createdAt + dueOffsetDays` (if provided)

This preserves historical integrity for already-created dockets.

## Docket Detail read-only visibility

Docket Detail now shows the docket checklist snapshot as a read-only checklist section (sorted by template sort order with required/completion labels). This is intentionally display-only in this phase (no checklist completion actions).

