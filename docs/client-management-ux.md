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
