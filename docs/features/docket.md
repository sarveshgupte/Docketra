# Docket Features

## Guided Docket Creation Flow

The Create Docket experience now uses a guided, 5-step workflow designed for faster and clearer docket intake.

### Steps overview

1. **Basic Info**
   - `title` (required)
   - `description` (optional)
2. **Classification**
   - `category` (optional)
   - `subcategory` (optional, validated against selected category)
3. **Routing**
   - `workbasket` (required)
   - `priority` (optional, defaults to `Medium`)
4. **Assignment**
   - `assignedTo` (optional)
   - if empty, the backend auto-assigns based on workbasket rules (manager fallback)
5. **Review & Create**
   - confirms a full summary before submission

### API contract

`POST /api/dockets/create`

```json
{
  "title": "GST Filing Follow-up",
  "description": "Client follow-up for pending filing",
  "categoryId": "<optional>",
  "subcategoryId": "<optional>",
  "workbasketId": "<required>",
  "priority": "medium",
  "assignedTo": "X000123"
}
```

Response:

```json
{
  "success": true,
  "message": "Docket created successfully",
  "data": {
    "docketId": "CASE-20260414-00001"
  }
}
```

### Notes

- Existing `POST /api/cases` continues to work for backward compatibility.
- Database collection names and historical identifiers may still use `Case` naming where migration risk is high.
- Screenshots should be captured during manual QA in environments where browser tooling is available.
