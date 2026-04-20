# CRM/CMS Testing Readiness Controls (Launch-Critical)

## What was added

### 1) Admin CMS intake settings (no code changes required)
A new admin-managed CMS intake settings surface is available in **Settings → Work settings** under **CMS Intake Settings**.

Controls included:
- Auto create client (on/off)
- Auto create docket (on/off)
- Default category
- Default subcategory
- Default workbasket
- Default priority
- Default assignee
- Intake API enabled (on/off)
- Intake API key regenerate flow
  - The current key is masked
  - Regeneration returns a one-time visible key for copying

### 2) CRM overview now reflects operational state
CRM landing now shows actionable counts:
- Leads by stage (new/contacted)
- Overdue follow-ups
- Clients added in last 7 days
- Unpaid invoices

### 3) CMS overview now reflects operational state
CMS landing now shows actionable counts:
- Active forms
- Submissions today
- Submissions in last 7 days
- Lead-only submissions
- Submissions converted into client
- Submissions converted into docket
- Routing/config warnings

### 4) Dead-end UX removed/reworded
- Removed duplicate/misleading CRM quick action that implied CSV import flow.
- Updated CMS wording from “Forms/Templates” to “Forms” where no template system exists.
- Added direct CMS → intake settings jump link for operational setup.

### 5) Launch smoke checks added
Added low-friction smoke coverage for critical launch paths:
- CMS form creation wiring
- Public submission route wiring
- CRM lead conversion + invoice paid API contracts
- CRM/CMS protected route integrity
- Admin intake settings route and API contract wiring

---

## Manual QA checklist (short)

1. **Configure intake**
   - Open `Settings → Work settings → CMS Intake Settings`.
   - Set defaults for category/subcategory/workbasket/priority/assignee.
   - Toggle auto-create switches and save.

2. **API intake key**
   - Regenerate intake key.
   - Confirm key is visible once, can be copied, and appears masked after refresh.

3. **Create a form**
   - Go to CMS, create a new form, save it, and copy public link.

4. **Public submission**
   - Open public form link and submit.
   - Confirm submission appears in CMS intake queue and CRM leads.

5. **Convert and bill**
   - Convert a lead to client in CRM.
   - Create invoice and mark paid.
   - Confirm unpaid invoice count decreases on CRM landing.

6. **Routing sanity**
   - Validate CRM/CMS quick action buttons route to the expected pages (no no-op or loopback dead-ends).
