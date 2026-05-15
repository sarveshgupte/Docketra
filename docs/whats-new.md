# What's New

## 2026-05 Work Management hardening
- Removed category/subcategory hard-delete exposure from admin work-management route contract.
- Tightened mutation validation for category/subcategory/workbasket routes using strict schemas.
- Sanitized category controller error responses to avoid raw backend `error.message` leakage.
- Added regression test for no-delete schema contract and strict payload behavior.
