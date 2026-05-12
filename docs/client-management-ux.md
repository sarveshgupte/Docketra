# Client management UX alignment (manual + bulk)

Manual **Add/Edit Client** and **Bulk Upload Clients** now use the same canonical client profile fields:

- `businessName` (**required**)
- `businessEmail` (optional, valid email if provided)
- `primaryContactNumber` (optional)
- `businessAddress` (optional)
- `PAN` (optional)
- `CIN` (optional)
- `TAN` (optional)
- `GST` (optional)
- `contactPersonName` (optional)

## Notes

- Manual Add/Edit Client keeps only `businessName` required to reduce friction.
- Optional blank fields are omitted from create/update payloads.
- Access-denial copy for client-management actions is standardized to: **"Client management access is required"**.

- Edit CFS on Clients now always refreshes details through `GET /api/clients/:clientId` before editing, then uses tenant-scoped CFS paths (`/api/clients/:clientId/fact-sheet` and `/api/clients/:clientId/cfs/files/*`) for updates/uploads/deletes.
- Edit CFS error states now use safe role-aware copy: `403 -> Client management access is required`, `404 -> Client not found or no longer available`, and `503 -> fact sheet resources unavailable` fallback messaging.
