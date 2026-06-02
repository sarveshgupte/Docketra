# Docketra Role Vocabulary

## Firm Roles

Docketra firm workspaces use exactly these user-facing firm roles:

- Primary Admin
- Admin
- Manager
- Employee

Do not introduce `Partner` as a firm role in UI copy, admin guidance, route guards, tests, or documentation.

## Storage Compatibility

Backend records may continue to store employee-tier users as `USER` for compatibility. User-facing copy must render `USER` as `Employee`.

## Access Rule Reminder

Compliance Control Room is a Manager-and-above view. Employee users should not see or directly access that view.
