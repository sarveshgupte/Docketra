# Subcategory Checklist Templates

This feature adds lightweight checklist templates at **subcategory** level in Category Management.

## Scope
- Templates are stored in `Category.subcategories[].checklistTemplate`.
- New dockets get a **snapshot** copied into `Case.checklist` at create time.
- Existing dockets are not mutated when templates change.

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
