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
Backend list endpoint supports filtering by `employeeXID` for firm-scoped queries.

## Default setup
Default setup template includes HR/Finance/Accounts/Operations category structure where HR subcategories are seeded with `employeeContextEnabled=true`, others false.
