# Testing Guide: Default Client Invariants PR

## 🧪 Overview

This guide provides step-by-step instructions for testing the Default Client invariants implementation. All acceptance criteria must be verified before deployment.

## 📋 Prerequisites

### Required Access
- Admin account credentials
- Access to API testing tool (Postman, curl, or browser DevTools)
- Access to application frontend
- Optional: Database access for verification

### Test Environment
- Backend API running on configured port (default: 5000)
- Frontend application running
- MongoDB connected with test data
- Default Client (C000001) exists in database

## 🔍 Test Scenarios

### Test Group 1: Backend API Validation

#### Test 1.1: Prevent Default Client Deactivation
**Objective:** Verify API blocks deactivation of C000001

**Steps:**
1. Get admin authentication token
2. Send PATCH request to deactivate C000001

**cURL Command:**
```bash
curl -X PATCH http://localhost:5000/api/clients/C000001/status \
  -H "Authorization: Bearer <test-auth-token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

**Expected Result:**
```json
{
  "success": false,
  "message": "Default client cannot be deactivated."
}
```

**HTTP Status:** 400 Bad Request

**✅ Pass Criteria:**
- Returns 400 status code
- Returns error message: "Default client cannot be deactivated."
- Database status remains ACTIVE for C000001

---

#### Test 1.2: Allow Default Client Activation (Edge Case)
**Objective:** Verify activation is allowed (though it should always be active)

**Steps:**
1. Attempt to activate C000001 (should succeed as no-op)

**cURL Command:**
```bash
curl -X PATCH http://localhost:5000/api/clients/C000001/status \
  -H "Authorization: Bearer <test-auth-token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "clientId": "C000001",
    "status": "ACTIVE",
    ...
  },
  "message": "Client activated successfully"
}
```

**HTTP Status:** 200 OK

**✅ Pass Criteria:**
- Returns 200 status code
- Status remains ACTIVE
- No error thrown

---

#### Test 1.3: Allow Other Client Deactivation
**Objective:** Verify non-default clients can still be deactivated

**Prerequisite:** Create test client (not C000001)

**Steps:**
1. Get a non-default client ID (e.g., C000002)
2. Deactivate the client

**cURL Command:**
```bash
curl -X PATCH http://localhost:5000/api/clients/C000002/status \
  -H "Authorization: Bearer <test-auth-token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "clientId": "C000002",
    "status": "INACTIVE",
    ...
  },
  "message": "Client deactivated successfully"
}
```

**HTTP Status:** 200 OK

**✅ Pass Criteria:**
- Returns 200 status code
- Status changed to INACTIVE
- isActive changed to false

---

#### Test 1.4: Get Clients for Create Case
**Objective:** Verify forCreateCase parameter always includes Default Client

**Test Case A - Default Client is Active:**
```bash
curl -X GET "http://localhost:5000/api/clients?forCreateCase=true" \
  -H "Authorization: Bearer <test-auth-token>"
```

**Expected:** C000001 included in results

**Test Case B - Default Client is Inactive (Manual DB Edit):**
1. Manually set C000001 status to INACTIVE in database
2. Run same query

**Expected:** C000001 STILL included in results

**✅ Pass Criteria:**
- C000001 always present in response
- Other clients included only if ACTIVE
- Results sorted by clientId

---

### Test Group 2: Frontend UI Validation

#### Test 2.1: Admin Page - Default Client Display
**Objective:** Verify Default Client has correct UI elements

**Steps:**
1. Log in as Admin
2. Navigate to Admin page
3. Select "Client Management" tab
4. Locate C000001 row

**Expected UI:**
- Client ID column shows: "C000001" with "Default" badge
- Status column shows: "Active" badge
- Actions column shows:
  - ✅ Edit button (enabled)
  - ✅ Change Name button (disabled)
  - ❌ NO Activate/Deactivate button

**Screenshot Checklist:**
- [ ] "Default" badge visible next to C000001
- [ ] No Activate/Deactivate button present
- [ ] Other buttons present and correctly enabled/disabled

**✅ Pass Criteria:**
- Default badge displayed
- Activate/Deactivate button completely hidden (not just disabled)
- Edit button present and disabled

---

#### Test 2.2: Admin Page - Active Client Display
**Objective:** Verify active clients show Deactivate button

**Steps:**
1. Locate an ACTIVE client (not C000001)
2. Check button display

**Expected UI:**
- Status shows: "Active" badge (green)
- Actions show: "Deactivate" button (red/danger variant)
- Button is enabled and clickable

**Test Action:**
- Click "Deactivate" button
- Confirm status changes to "Inactive"
- Confirm button changes to "Activate"

**✅ Pass Criteria:**
- Active clients show "Deactivate" button
- Button variant is "danger" (red)
- Status toggles correctly

---

#### Test 2.3: Admin Page - Inactive Client Display
**Objective:** Verify inactive clients show Activate button

**Steps:**
1. Locate an INACTIVE client
2. Check button display

**Expected UI:**
- Status shows: "Inactive" badge (red)
- Actions show: "Activate" button (green/success variant)
- Button is enabled and clickable

**Test Action:**
- Click "Activate" button
- Confirm status changes to "Active"
- Confirm button changes to "Deactivate"

**✅ Pass Criteria:**
- Inactive clients show "Activate" button
- Button variant is "success" (green)
- Status toggles correctly

---

#### Test 2.4: Create Case Page - Client Dropdown
**Objective:** Verify Default Client is always present and preselected

**Test Case A - Normal State:**
1. Navigate to Create Case page
2. Check Client dropdown

**Expected:**
- Dropdown populated with clients
- C000001 – Default Client is present
- C000001 is preselected (default selection)
- Format: "C000001 – Default Client"

**Test Case B - After Deactivating Other Clients:**
1. Deactivate all other clients (not C000001)
2. Navigate to Create Case page
3. Check Client dropdown

**Expected:**
- Only C000001 appears in dropdown
- C000001 still preselected

**Test Case C - With Active Clients:**
1. Ensure some clients are active
2. Check dropdown

**Expected:**
- C000001 appears
- All ACTIVE clients appear
- INACTIVE clients do NOT appear (except C000001)

**✅ Pass Criteria:**
- C000001 always in dropdown
- C000001 preselected by default
- Format matches: "ClientID – Business Name"
- Only active clients shown (plus C000001)

---

### Test Group 3: Edge Cases & Error Handling

#### Test 3.1: Concurrent Deactivation Attempts
**Objective:** Verify race condition handling

**Steps:**
1. Open two browser tabs with Admin logged in
2. In both tabs, navigate to C000002 (non-default client)
3. In Tab 1, click "Deactivate"
4. Immediately in Tab 2, click "Deactivate"

**Expected:**
- Both requests handled gracefully
- No database corruption
- Final status is INACTIVE

**✅ Pass Criteria:**
- No server errors
- Consistent final state
- Proper error messages if applicable

---

#### Test 3.2: Invalid Client ID
**Objective:** Verify 404 handling

**cURL Command:**
```bash
curl -X PATCH http://localhost:5000/api/clients/C999999/status \
  -H "Authorization: Bearer <test-auth-token>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

**Expected Result:**
```json
{
  "success": false,
  "message": "Client not found"
}
```

**HTTP Status:** 404 Not Found

**✅ Pass Criteria:**
- Returns 404 status code
- Clear error message
- No database changes

---

#### Test 3.3: Missing Authorization
**Objective:** Verify authentication still enforced

**cURL Command:**
```bash
curl -X PATCH http://localhost:5000/api/clients/C000002/status \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

**Expected:** 401 Unauthorized

**✅ Pass Criteria:**
- Returns 401 status code
- No database changes
- Authorization middleware working

---

#### Test 3.4: Non-Admin User
**Objective:** Verify only admins can change status

**Steps:**
1. Log in as non-admin user (Employee role)
2. Attempt to deactivate a client

**Expected:** 403 Forbidden or redirect

**✅ Pass Criteria:**
- Non-admins cannot access endpoint
- Proper authorization enforcement

---

### Test Group 4: Integration Tests

#### Test 4.1: Full Case Creation Workflow
**Objective:** Verify end-to-end case creation with Default Client

**Steps:**
1. Log in as any user
2. Navigate to Create Case
3. Verify C000001 is preselected
4. Fill in required fields
5. Create case
6. Verify case created with C000001

**✅ Pass Criteria:**
- Case created successfully
- Case linked to C000001
- No errors in workflow

---

#### Test 4.2: Client Status Change Impact
**Objective:** Verify status changes don't affect Default Client

**Steps:**
1. Deactivate all clients except C000001
2. Navigate to Create Case
3. Verify C000001 still available
4. Create case successfully

**✅ Pass Criteria:**
- Create Case still functional
- C000001 available
- No system errors

---

## 📊 Test Results Template

### Test Execution Summary

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Prevent Default Client Deactivation | ⬜ | |
| 1.2 | Allow Default Client Activation | ⬜ | |
| 1.3 | Allow Other Client Deactivation | ⬜ | |
| 1.4 | Get Clients for Create Case | ⬜ | |
| 2.1 | Admin Page - Default Client Display | ⬜ | |
| 2.2 | Admin Page - Active Client Display | ⬜ | |
| 2.3 | Admin Page - Inactive Client Display | ⬜ | |
| 2.4 | Create Case Page - Client Dropdown | ⬜ | |
| 3.1 | Concurrent Deactivation Attempts | ⬜ | |
| 3.2 | Invalid Client ID | ⬜ | |
| 3.3 | Missing Authorization | ⬜ | |
| 3.4 | Non-Admin User | ⬜ | |
| 4.1 | Full Case Creation Workflow | ⬜ | |
| 4.2 | Client Status Change Impact | ⬜ | |

**Legend:**
- ⬜ Not Tested
- ✅ Passed
- ❌ Failed
- ⚠️ Passed with Issues

---

## 🐛 Bug Report Template

If a test fails, use this template to report:

```markdown
### Bug Report: [Test ID] - [Test Name]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Environment:**
- Browser: [Browser name and version]
- OS: [Operating system]
- API Version: [Version number]

**Screenshots:**
[Attach screenshots if applicable]

**Console Logs:**
[Attach any relevant error messages]

**Priority:** [High/Medium/Low]
```

---

## ✅ Acceptance Criteria Checklist

Before marking PR as ready for merge, verify:

### Client Management
- [ ] Default Client has no Activate/Deactivate button in UI
- [ ] Default Client cannot be deactivated via API (returns 400)
- [ ] Default Client has "Default" badge in Admin UI
- [ ] Active clients show "Deactivate" button
- [ ] Inactive clients show "Activate" button
- [ ] Status field is used consistently (not isActive)

### Create Case
- [ ] Default Client always appears in dropdown
- [ ] Default Client is preselected by default
- [ ] Other clients appear only if ACTIVE
- [ ] Dropdown format is "ClientID – Business Name"

### Safety & Integrity
- [ ] No API allows Default Client deactivation
- [ ] UI reflects backend truth (uses status field)
- [ ] No regression in existing case creation
- [ ] Authorization still enforced properly

### Error Handling
- [ ] Clear error messages for invalid operations
- [ ] Proper HTTP status codes
- [ ] No console errors in browser
- [ ] No server crashes

---

## 📝 Notes

### Known Limitations
- Pre-existing issue: Rate limiting not implemented (not in scope)
- Manual database edits could theoretically set C000001 to INACTIVE, but API prevents it

### Test Data Cleanup
After testing, ensure:
- Reset any manually changed statuses
- Remove test clients if created
- Verify C000001 is ACTIVE

### Performance Testing
Not required for this PR, but consider:
- Load testing with many concurrent client requests
- Database query performance with large client lists

---

## 🎯 Testing Completion

When all tests pass:
1. ✅ Fill in test results table
2. ✅ Document any issues found and resolved
3. ✅ Take screenshots of key UI changes
4. ✅ Confirm all acceptance criteria met
5. ✅ Approve PR for merge

**Tester Signature:** _________________  
**Date:** _________________  
**Overall Result:** ⬜ PASS / ⬜ FAIL / ⬜ CONDITIONAL PASS
