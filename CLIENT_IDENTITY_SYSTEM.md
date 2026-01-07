# Client Identity System - Implementation Documentation

## Overview

This implementation provides a first-class, immutable Client identity system with case-driven workflows for all client operations. The system enforces data correctness and governance through:

- **Unique Client IDs** in C123456 format (immutable)
- **Default Organization Client** (C123456)
- **Mandatory client association** for every case
- **Case-driven client creation & edits** (Admin approval required)
- **Zero direct tampering** possible

---

## 🆔 Client Identity Rules

### Client ID Format
- **Format**: `C123456` (no dash, 6 digits minimum)
- **Auto-generated** via pre-save hook
- **Immutable forever** (enforced at schema level)
- Primary identifier for all cases

### Default Organization Client
System-created client:
- **clientId**: `C123456`
- **businessName**: "Organization"
- **isSystemClient**: `true` (cannot be deleted or edited)
- Used for internal/organization work

**Critical Rule**: There must NEVER be a case without a client.

---

## 🏢 Client Data Model

Each client record stores:

### Core Fields (Required)
- `clientId` - Immutable unique identifier (C123456 format)
- `businessName` - Client/business name
- `businessAddress` - Physical address
- `businessPhone` - Contact phone
- `businessEmail` - Contact email

### Regulatory Fields (Optional)
- `PAN` - Permanent Account Number
- `GST` - Goods and Services Tax Number
- `CIN` - Corporate Identification Number

### Location Fields (Optional, Future-proof)
- `latitude` - GPS latitude
- `longitude` - GPS longitude

### System Flags
- `isSystemClient` (boolean) - true for organization client only
- `isActive` (boolean) - soft delete mechanism
- `createdBy` (string) - email of creator (Admin)

### Timestamps (Auto-managed)
- `createdAt`
- `updatedAt`

---

## 📁 Case ↔ Client Enforcement

Every case **MUST**:
1. Reference exactly ONE `clientId` (String field, not ObjectId)
2. Either a real client (e.g., `C654321`) OR the organization client (`C123456`)

### Case Data Includes Client Info
When fetching cases (GET /api/cases or GET /api/cases/:caseId):
- Response includes `clientId`
- Response includes client details: `businessName`, `businessPhone`, `businessEmail`

### Client Snapshot
Cases store a `clientSnapshot` at creation time:
- Preserves client data as it was when case was created
- Immutable audit trail
- Includes: clientId, businessName, businessPhone, businessEmail, businessAddress, PAN, GST, CIN

---

## ➕ Client Creation via Cases ONLY

### Workflow: Add New Client

1. **Create a case with category**: `Client – New`
2. **Case description** must contain JSON with client details:
   ```json
   {
     "businessName": "ABC Company",
     "businessAddress": "123 Street",
     "businessPhone": "1234567890",
     "businessEmail": "contact@abc.com",
     "PAN": "ABCDE1234F",
     "GST": "27ABCDE1234F1Z5",
     "CIN": "U12345AB2020PTC123456"
   }
   ```
3. **Case status flow**: `Created` → `Reviewed` → `Approved`
4. **Admin approval endpoint**: `POST /api/client-approval/:caseId/approve-new`
   - Requires: `approverEmail`, `comment` (mandatory)
   - Creates new Client record
   - Auto-generates `clientId`
   - Closes case with status `Closed`
   - Logs in `CaseHistory`: "Client created via case DCK-XXXX"

### API Endpoint
```
POST /api/client-approval/:caseId/approve-new
Body: {
  "approverEmail": "admin@example.com",
  "comment": "Approved - Client verified"
}
```

---

## ✏️ Client Edit via Cases ONLY

### Workflow: Edit Existing Client

1. **Create a case with category**: `Client – Edit`
2. **Case description** must contain JSON with edit data:
   ```json
   {
     "clientId": "C654321",
     "updates": {
       "businessPhone": "9876543210",
       "businessEmail": "newemail@abc.com"
     }
   }
   ```
3. **Anyone can raise** the case
4. **Only Admin can approve** (status must be `Reviewed`)
5. **Admin approval endpoint**: `POST /api/client-approval/:caseId/approve-edit`
   - Requires: `approverEmail`, `comment` (mandatory)
   - Updates Client record
   - Old values preserved in audit trail
   - Closes case
   - Logs changes in `CaseHistory` with before/after values

### API Endpoint
```
POST /api/client-approval/:caseId/approve-edit
Body: {
  "approverEmail": "admin@example.com",
  "comment": "Approved - Phone and email updated"
}
```

### Audit Trail Example
CaseHistory entry:
```
actionType: "ClientUpdated"
description: "Client C654321 updated via case DCK-0042. Changes: businessPhone: '1234567890' → '9876543210'; businessEmail: 'old@abc.com' → 'newemail@abc.com'"
performedBy: "admin@example.com"
```

---

## 🔒 Anti-Tampering Guarantees

### Schema-level Protection
- `clientId` → **immutable: true** (Mongoose schema)
- `isSystemClient` → **immutable: true** (cannot change after creation)

### API-level Protection
- ❌ **No endpoint** to directly edit client
- ❌ **No endpoint** to delete client
- ❌ **No silent admin edits**
- ✅ **Only read-only endpoints**: GET /api/client-approval/clients

### Workflow-level Control
Client data mutates **ONLY** on:
- Admin-approved "Client - New" case close
- Admin-approved "Client - Edit" case close

### Audit Trail
Every client mutation:
- Linked to Case ID
- Append-only `CaseHistory` log
- Never editable (pre-update hooks prevent modifications)
- Never deletable (pre-delete hooks prevent deletions)

**Even admins cannot hide changes.**

---

## 📂 Files Structure

```
src/
├── models/
│   ├── Client.model.js           (UPDATED - New schema with C123456 format)
│   ├── Case.model.js              (UPDATED - Mandatory clientId field)
│   └── CaseHistory.model.js       (EXISTING - Immutable audit log)
├── controllers/
│   ├── case.controller.js         (UPDATED - Client validation added)
│   └── clientApproval.controller.js  (NEW - Case-driven workflows)
├── routes/
│   ├── case.routes.js             (EXISTING - Case management)
│   └── clientApproval.routes.js   (NEW - Client approval endpoints)
├── scripts/
│   └── seedOrganizationClient.js  (NEW - Seeds C123456)
└── server.js                      (UPDATED - Wire up client routes)
```

---

## 🚀 Setup Instructions

### 1. Seed Organization Client
```bash
node src/scripts/seedOrganizationClient.js
```

This creates the mandatory organization client (C123456).

### 2. Seed Categories
```bash
node src/scripts/seedCategories.js
```

This creates system categories including "Client - New" and "Client - Edit".

### 3. Start Server
```bash
npm start
```

---

## 📋 API Endpoints

### Client Read-Only Endpoints

#### List All Clients
```
GET /api/client-approval/clients?page=1&limit=20&includeInactive=false
```

#### Get Client by ID
```
GET /api/client-approval/clients/:clientId
```

### Case-Driven Client Workflows (Admin Only)

#### Approve New Client
```
POST /api/client-approval/:caseId/approve-new
Body: {
  "approverEmail": "admin@example.com",
  "comment": "Client verified and approved"
}
```

#### Approve Client Edit
```
POST /api/client-approval/:caseId/approve-edit
Body: {
  "approverEmail": "admin@example.com",
  "comment": "Changes approved"
}
```

#### Reject Client Case
```
POST /api/client-approval/:caseId/reject
Body: {
  "approverEmail": "admin@example.com",
  "comment": "Incomplete information"
}
```

### Case Endpoints (Updated)

#### Create Case (Now Requires clientId)
```
POST /api/cases
Body: {
  "title": "New Matter",
  "description": "...",
  "category": "Sales",
  "clientId": "C123456",  // MANDATORY
  "createdBy": "user@example.com",
  "priority": "Medium"
}
```

#### Get Cases with Client Info
```
GET /api/cases
Response includes client details for each case
```

---

## ✅ Acceptance Checklist

- [x] Default organization client exists (C123456)
- [x] Every case requires a clientId (enforced at schema level)
- [x] Client add/edit only via cases (no direct edit APIs)
- [x] Admin approval required for DB mutation
- [x] Immutable clientId enforced at schema level
- [x] Full audit trail present (CaseHistory)
- [x] No direct client edit APIs exist

---

## 🔍 Verification Examples

### Example 1: Create Client via Case

1. Create case:
```bash
POST /api/cases
{
  "title": "New Client - XYZ Corp",
  "description": "{\"businessName\":\"XYZ Corp\",\"businessAddress\":\"456 Avenue\",\"businessPhone\":\"1112223333\",\"businessEmail\":\"info@xyz.com\",\"PAN\":\"XYZPQ5678R\"}",
  "category": "Client - New",
  "clientId": "C123456",
  "createdBy": "user@example.com"
}
```

2. Update case to Reviewed status
3. Admin approves:
```bash
POST /api/client-approval/DCK-0001/approve-new
{
  "approverEmail": "admin@example.com",
  "comment": "Client verified"
}
```

4. Result: New client created with auto-generated clientId (e.g., C654321)

### Example 2: Edit Client via Case

1. Create case:
```bash
POST /api/cases
{
  "title": "Update XYZ Corp Phone",
  "description": "{\"clientId\":\"C654321\",\"updates\":{\"businessPhone\":\"9998887777\"}}",
  "category": "Client - Edit",
  "clientId": "C654321",
  "createdBy": "user@example.com"
}
```

2. Update case to Reviewed status
3. Admin approves:
```bash
POST /api/client-approval/DCK-0002/approve-edit
{
  "approverEmail": "admin@example.com",
  "comment": "Phone number verified"
}
```

4. Result: Client C654321 updated, old value logged in CaseHistory

---

## 🛡️ Security Features

1. **Schema-level Immutability**: clientId and isSystemClient cannot be modified
2. **No Direct Mutation APIs**: All changes via case workflow
3. **Mandatory Admin Approval**: Comments required for accountability
4. **Append-only Audit Log**: CaseHistory prevents updates/deletes
5. **Client Validation**: Case creation validates client exists
6. **System Client Protection**: Organization client cannot be edited/deleted

---

## 📝 Notes

- The implementation uses Mongoose schema-level immutability for clientId
- CaseHistory model has pre-save hooks to prevent updates/deletes
- Client snapshot in cases preserves client data at case creation time
- All mutations are tracked with before/after values in audit trail
- System follows principle of least privilege - no shortcuts possible

---

## 🎯 Constraints Met

✅ No UI changes
✅ No search changes  
✅ No auth changes
✅ Data correctness enforced
✅ Immutability guaranteed
✅ Audit trail complete
✅ Admin approval gate active
