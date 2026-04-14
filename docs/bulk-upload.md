# Bulk Upload

## CSV Schema Validation

Bulk upload now uses a centralized schema at `ui/src/constants/bulkUploadSchema.js`.

This ensures:
- Templates match backend-expected headers and required fields.
- Required fields are enforced on the client before preview/upload.
- Header normalization + alias mapping is consistent across template generation and upload validation.
- Fewer avoidable upload errors and support tickets.

## Error Reporting

If validation fails, users can download a CSV containing:
- Row number
- Original row data
- Error message

This allows quick correction in Excel before re-uploading.
