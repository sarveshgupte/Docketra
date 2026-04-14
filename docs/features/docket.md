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

## Default Firm Setup

When a new firm is created (or a firm has no category/workbasket setup), the platform auto-provisions a zero-configuration docket setup so teams can create dockets immediately.

### Default categories and subcategories

- **Compliance**
  - GST Filing → Compliance Team
  - ROC Filing → Compliance Team
- **Tax**
  - Income Tax Return → Tax Team
  - TDS Filing → Tax Team
- **Internal**
  - Admin Task → General
  - Follow-up → General

All default categories/subcategories are created as active. Subcategories are created with explicit workbasket mappings to guarantee guided routing works from day one.

### Default workbaskets

- **General**
- **Compliance Team**
- **Tax Team**

All default workbaskets are created as active under the firm and are auto-managed by the primary admin user created during onboarding.

### Mapping logic and safety

- Setup is idempotent: re-running firm setup does not create duplicates.
- Setup executes transactionally when called inside an existing transaction/session.
- Existing firms are not disrupted: setup only auto-runs for new firms or firms missing category/workbasket setup, unless explicitly forced by reset/clone flows.
- Superadmin template customization and clone/reset flows are supported by the firm setup service layer for controlled rollout.

### Notes

- Existing `POST /api/cases` continues to work for backward compatibility.
- Database collection names and historical identifiers may still use `Case` naming where migration risk is high.
- Screenshots should be captured during manual QA in environments where browser tooling is available.
