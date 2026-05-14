# Client management UX alignment (manual + bulk)

Manual **Add/Edit Client** and **Bulk Upload Clients** now use the same canonical client profile fields:

Required:
- `businessName`
- `businessEmail`
- `primaryContactNumber`
- `businessAddress`
- `city`
- `state`
- `pincode`
- `contactPersonName`
- `contactPersonEmail`
- `contactPersonPhone`

Optional:
- `PAN`
- `GST`
- `TAN`
- `CIN`

## Notes

- Access-denial copy for client-management actions is standardized to: **"Client management requires Admin access"**.
- Edit CFS on Clients now always refreshes details through `GET /api/clients/:clientId` before editing, then uses tenant-scoped CFS paths (`/api/clients/:clientId/fact-sheet` and `/api/clients/:clientId/cfs/files/*`) for updates/uploads/deletes.
- Edit CFS error states now use safe role-aware copy: `403 -> Client management requires Admin access`, `404 -> Client not found or no longer available`, and `503 -> fact sheet resources unavailable` fallback messaging.
- Kept BYOS-not-connected as a normal state and clarified that Docketra-managed storage remains active by default.
