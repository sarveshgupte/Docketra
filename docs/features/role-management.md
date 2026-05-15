# Role Management (Work Management access)

## Work Management access policy
Work Management settings are manager-and-above only:
- PRIMARY_ADMIN
- ADMIN
- MANAGER

Denied:
- USER/EMPLOYEE
- SUPER_ADMIN on firm-scoped admin routes

## Work Management policy guardrails
- Deactivate-only lifecycle for category/subcategory/workbasket in standard operations.
- No hard delete endpoints exposed for category/subcategory in admin route contract.
