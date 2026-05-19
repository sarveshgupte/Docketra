# Added optional related employee/user context for dockets

- `clientId` remains required as the primary anchor for every docket.
- `relatedEmployeeUser` is optional on docket creation and persistence.
- Active and inactive/deactivated users can be selected.
- Deleted users are excluded.
- Assignment/routing/workbasket/QC ownership behavior is unchanged.
- `relatedEmployeeUser` is stored as a snapshot (`userId`, `xID`, `name`, `email`, `status`) for historical clarity.
