# Employee Context for Dockets (Optional)

Docketra remains a work/task manager. This feature adds **optional employee context** for relevant dockets and is **not** an HRMS module.

## Definitions
- **Employee**: person the docket is about.
- **Assignee**: person responsible for executing the docket work.
- **User**: person with Docketra access.

Employee and assignee are separate fields in UI and persistence.

## Configuration: `employeeContextEnabled`
- Implemented on **category subcategory config** (`Category.subcategories[].employeeContextEnabled`).
- Defaults to `false` unless explicitly enabled.
- Guided create form shows Employee selector only when selected subcategory has `employeeContextEnabled=true`.

## Optional behavior
- Employee selection is always optional.
- HR/employee-context dockets can be created with or without an employee.
- Non-employee-context subcategories reject employee context if provided.

## Data model
Case stores optional fields:
- `employeeXID` (nullable)
- `employeeSnapshot`:
  - `xID`
  - `name`
  - `email`
  - `department`
  - `statusAtTime`

Snapshot preserves historical display even if user profile changes later.

## Validation rules
When employee is provided during create:
- Must be same-firm user.
- Must be active (`status=active` and `isActive != false`).

Assignee logic remains unchanged:
- `assignedToXID` continues to be canonical assignee field.
- `employeeXID` is informational context only.

## Employee source
Employee dropdown is sourced from firm users managed in Team Management/Admin (`User` records), filtered to active users.

## Filtering support
Backend list endpoint supports filtering by `employeeXID` for firm-scoped queries (`GET /api/cases?employeeXID=X000123`). Tenant scoping remains enforced by the service query guard.

> TODO (UI scope): add a dedicated Employee filter control only when an employee-context subcategory/HR context is active in the docket list filter model.

## Default setup
Default setup template includes HR/Finance/Accounts/Operations category structure where HR subcategories are seeded with `employeeContextEnabled=true`, others false. This template is applied for new setup/explicit setup flows and does not silently overwrite already-configured firms.

If subcategory-level editing of `employeeContextEnabled` is not yet exposed in Settings UI, current behavior is still deterministic via seeded defaults; admin UI control can be added in a future settings-focused PR.
