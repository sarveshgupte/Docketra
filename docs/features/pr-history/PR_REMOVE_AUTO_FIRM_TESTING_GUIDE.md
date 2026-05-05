# Testing Guide: Remove Auto-Firm Creation Feature

## Overview

This guide provides step-by-step instructions for manually testing the changes made in the "Remove Auto-Firm Creation" PR.

**PR Objective:** Ensure firms are created ONLY by SuperAdmin via transactional API, with no auto-creation of FIRM001.

---

## Prerequisites

### Required Setup

1. **MongoDB Access**: Direct access to MongoDB for data verification
2. **SuperAdmin Credentials**: Valid SuperAdmin login credentials
3. **API Client**: Postman, curl, or similar tool for API testing
4. **Environment**: Staging or test environment (NOT production)

### Environment Variables

Ensure these are configured in `.env`:

```bash
NODE_ENV=development
MONGODB_URI=<your_mongodb_uri>
JWT_SECRET=<your_jwt_secret>
SUPERADMIN_XID=SUPERADMIN
SUPERADMIN_EMAIL=superadmin@test.local
SUPERADMIN_PASSWORD=<secure_password>
```

---

## Test Suite

### Test 1: Empty Database Bootstrap ✅

**Objective:** Verify server starts successfully with empty database and no FIRM001 auto-creation.

#### Steps

1. **Clear all firms from database:**
   ```javascript
   // In MongoDB shell or Compass
   use docketra
   db.firms.deleteMany({})
   db.clients.deleteMany({})
   db.users.deleteMany({ role: 'Admin' })
   
   // Verify deletion
   db.firms.countDocuments()  // Should return 0
   ```

2. **Restart the backend server:**
   ```bash
   npm start
   ```

3. **Check console output:**

   **Expected Output:**
   ```
   ╔════════════════════════════════════════════╗
   ║  Running Bootstrap Checks...               ║
   ╚════════════════════════════════════════════╝

   🔍 Running preflight data validation checks...
   ℹ️  No firms exist yet. This is expected - firms are created by SuperAdmin.
   ✓ All preflight checks passed (empty database is valid)

   ✓ Bootstrap completed successfully

   ╔════════════════════════════════════════════╗
   ║         Docketra API Server                ║
   ║                                            ║
   ║  Status: Running                           ║
   ║  Port: 5000                                ║
   ║  Environment: development                  ║
   ║  URL: http://localhost:5000                ║
   ║                                            ║
   ║  API Documentation: /api                   ║
   ║  Health Check: /health                     ║
   ╚════════════════════════════════════════════╝
   ```

4. **Verify no firms created:**
   ```javascript
   db.firms.find()  // Should return empty array []
   ```

5. **Check for no error emails:**
   - No "System Integrity Warning" email sent
   - Console should show no email-related errors

#### Success Criteria

- ✅ Server starts without errors
- ✅ Bootstrap logs "No firms exist yet. This is expected..."
- ✅ No FIRM001 auto-created
- ✅ No error emails sent
- ✅ Server is healthy (GET /health returns 200)

---

### Test 2: SuperAdmin Login (Empty DB) ✅

**Objective:** Verify SuperAdmin can log in when no firms exist.

#### Steps

1. **Login as SuperAdmin:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "superadmin@test.local",
       "password": "<superadmin_password>"
     }'
   ```

2. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Login successful",
     "token": "<test-jwt-token>",
     "user": {
       "xID": "SUPERADMIN",
       "email": "superadmin@test.local",
       "role": "SuperAdmin",
       "_id": "SUPERADMIN",
       "isActive": true
     }
   }
   ```

3. **Save the JWT token** for subsequent requests.

#### Success Criteria

- ✅ Login succeeds (200 OK)
- ✅ Token returned
- ✅ User object has role: "SuperAdmin"

---

### Test 3: Firm Creation (Happy Path) ✅

**Objective:** Verify SuperAdmin can create a firm with proper transactional guarantees.

#### Steps

1. **Create first firm:**
   ```bash
   curl -X POST http://localhost:5000/api/superadmin/firms \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <superadmin_token>" \
     -d '{
       "name": "Test Firm One",
       "adminName": "John Doe",
       "adminEmail": "john.doe@testfirm.com"
     }'
   ```

2. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Firm created successfully with default client and admin. Admin credentials sent by email.",
     "data": {
       "firm": {
         "_id": "...",
         "firmId": "FIRM001",
         "name": "Test Firm One",
         "status": "ACTIVE",
         "defaultClientId": "...",
         "createdAt": "2026-01-10T..."
       },
       "defaultClient": {
         "_id": "...",
         "clientId": "C000001",
         "businessName": "Test Firm One",
         "isSystemClient": true
       },
       "defaultAdmin": {
         "_id": "...",
         "xID": "X000001",
         "name": "John Doe",
         "email": "john.doe@testfirm.com",
         "role": "Admin",
         "status": "INVITED"
       }
     }
   }
   ```

3. **Verify in database:**
   ```javascript
   // Check firm
   db.firms.findOne({ firmId: 'FIRM001' })
   // Should have: defaultClientId (not null)
   
   // Check client
   db.clients.findOne({ clientId: 'C000001' })
   // Should have: firmId (ObjectId), isSystemClient: true
   
   // Check admin
   db.users.findOne({ xID: 'X000001' })
   // Should have: firmId (ObjectId), defaultClientId (ObjectId), role: 'Admin'
   ```

4. **Verify data relationships:**
   ```javascript
   const firm = db.firms.findOne({ firmId: 'FIRM001' })
   const client = db.clients.findOne({ _id: firm.defaultClientId })
   const admin = db.users.findOne({ xID: 'X000001' })
   
   // Verify:
   // 1. client.firmId === firm._id
   // 2. admin.firmId === firm._id
   // 3. admin.defaultClientId === client._id
   ```

5. **Check console logs:**
   ```
   [FIRM_CREATE] Starting atomic transaction for firm: Test Firm One
   [FIRM_CREATE] ✓ Firm created: FIRM001
   [FIRM_CREATE] ✓ Default client created: C000001
   [FIRM_CREATE] ✓ Firm.defaultClientId linked to C000001
   [FIRM_CREATE] ✓ Default admin created: X000001
   [FIRM_CREATE] ✓✓✓ Transaction committed successfully for FIRM001
   [FIRM_CREATE] ✓ Firm created email sent to SuperAdmin
   [FIRM_CREATE] ✓ Admin invite email sent to john.doe@testfirm.com
   ```

6. **Check emails (if email configured):**
   - SuperAdmin receives "Firm Created SUCCESS" email
   - Admin receives "Password Setup" email with token

#### Success Criteria

- ✅ Firm created (201 Created)
- ✅ firmId is FIRM001 (first firm)
- ✅ Client created (C000001)
- ✅ Admin created (X000001)
- ✅ firm.defaultClientId === client._id
- ✅ admin.firmId === firm._id
- ✅ admin.defaultClientId === client._id
- ✅ Transaction logged in console
- ✅ Emails sent (if configured)

---

### Test 4: Second Firm Creation ✅

**Objective:** Verify sequential firm IDs are generated correctly.

#### Steps

1. **Create second firm:**
   ```bash
   curl -X POST http://localhost:5000/api/superadmin/firms \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <superadmin_token>" \
     -d '{
       "name": "Test Firm Two",
       "adminName": "Jane Smith",
       "adminEmail": "jane.smith@testfirm2.com"
     }'
   ```

2. **Expected Response:**
   ```json
   {
     "success": true,
     "data": {
       "firm": {
         "firmId": "FIRM002",
         "name": "Test Firm Two",
         "defaultClientId": "..."
       },
       "defaultClient": {
         "clientId": "C000001",
         "businessName": "Test Firm Two"
       },
       "defaultAdmin": {
         "xID": "X000001",
         "name": "Jane Smith",
         "email": "jane.smith@testfirm2.com"
       }
     }
   }
   ```

3. **Verify firm-scoped IDs:**
   ```javascript
   // FIRM002 should have its own C000001 and X000001
   // These are firm-scoped, not global
   
   const firm1Clients = db.clients.find({ 
     firmId: db.firms.findOne({ firmId: 'FIRM001' })._id 
   }).toArray()
   // Should show clientId: 'C000001'
   
   const firm2Clients = db.clients.find({ 
     firmId: db.firms.findOne({ firmId: 'FIRM002' })._id 
   }).toArray()
   // Should also show clientId: 'C000001' (firm-scoped!)
   ```

#### Success Criteria

- ✅ Second firm created successfully
- ✅ firmId is FIRM002 (sequential)
- ✅ Client ID is C000001 (firm-scoped, starts fresh)
- ✅ Admin xID is X000001 (firm-scoped, starts fresh)
- ✅ Both firms are independent

---

### Test 5: Transaction Rollback (Negative Test) ✅

**Objective:** Verify transaction rollback when firm creation fails.

#### Steps

1. **Attempt to create firm with duplicate admin email:**
   ```bash
   curl -X POST http://localhost:5000/api/superadmin/firms \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <superadmin_token>" \
     -d '{
       "name": "Test Firm Three",
       "adminName": "John Doe Again",
       "adminEmail": "john.doe@testfirm.com"
     }'
   ```

2. **Expected Response:**
   ```json
   {
     "success": false,
     "message": "User with this email already exists"
   }
   ```

3. **Expected Status Code:** 409 Conflict

4. **Verify NO data created:**
   ```javascript
   db.firms.countDocuments({ firmId: 'FIRM003' })  // Should be 0
   db.clients.countDocuments({ firmId: 'FIRM003' }) // Should be 0
   ```

5. **Check console logs:**
   ```
   [FIRM_CREATE] Starting atomic transaction for firm: Test Firm Three
   [SUPERADMIN] Error creating firm: User with this email already exists
   [SUPERADMIN] Transaction rolled back
   ```

#### Success Criteria

- ✅ Request fails (409 Conflict)
- ✅ Error message is clear
- ✅ NO firm created (transaction rolled back)
- ✅ NO client created
- ✅ NO admin created
- ✅ Database state unchanged

---

### Test 6: Missing firmId Error (Negative Test) ✅

**Objective:** Verify explicit error when user lacks firmId.

#### Steps

1. **Create a test user without firmId:**
   ```javascript
   // In MongoDB
   db.users.insertOne({
     xID: 'X999999',
     name: 'Invalid User',
     email: 'invalid@test.com',
     passwordHash: '$2b$10$...',
     role: 'Employee',
     status: 'ACTIVE',
     passwordSet: true,
     // NO firmId field
   })
   ```

2. **Login as this user:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "invalid@test.com",
       "password": "password123"
     }'
   ```

3. **Attempt to create a case:**
   ```bash
   curl -X POST http://localhost:5000/api/cases \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <invalid_user_token>" \
     -d '{
       "title": "Test Case",
       "description": "Test",
       "categoryId": "...",
       "subcategoryId": "...",
       "clientId": "C000001",
       "slaDueDate": "2026-01-15T00:00:00.000Z"
     }'
   ```

4. **Expected Response:**
   ```json
   {
     "success": false,
     "message": "User must be assigned to a firm to create cases"
   }
   ```

5. **Expected Status Code:** 403 Forbidden

#### Success Criteria

- ✅ Case creation fails (403 Forbidden)
- ✅ Error message is explicit
- ✅ NO case created in database
- ✅ Error logged in console

---

### Test 7: Server Restart with Existing Firms ✅

**Objective:** Verify bootstrap validates existing firms without creating new ones.

#### Steps

1. **Restart server** (with FIRM001 and FIRM002 existing):
   ```bash
   npm start
   ```

2. **Expected Console Output:**
   ```
   ╔════════════════════════════════════════════╗
   ║  Running Bootstrap Checks...               ║
   ╚════════════════════════════════════════════╝

   🔍 Running preflight data validation checks...
   ℹ️  Found 2 firm(s) in database. Validating integrity...
   ✓ All preflight checks passed - data hierarchy is consistent

   ✓ Bootstrap completed successfully
   ```

3. **Verify firm count unchanged:**
   ```javascript
   db.firms.countDocuments()  // Should still be 2
   ```

#### Success Criteria

- ✅ Server starts successfully
- ✅ Bootstrap logs "Found 2 firm(s)"
- ✅ Bootstrap logs "All preflight checks passed"
- ✅ NO new firms created
- ✅ Existing firms unchanged

---

### Test 8: Integrity Violation Detection ✅

**Objective:** Verify integrity checker detects but does not fix broken data.

#### Steps

1. **Create a broken firm (for testing):**
   ```javascript
   // In MongoDB
   db.firms.insertOne({
     firmId: 'FIRM999',
     name: 'Broken Firm',
     status: 'ACTIVE',
     // NO defaultClientId - this violates hierarchy
   })
   ```

2. **Restart server:**
   ```bash
   npm start
   ```

3. **Expected Console Output:**
   ```
   🔍 Running preflight data validation checks...
   ℹ️  Found 3 firm(s) in database. Validating integrity...
   ⚠️  WARNING: Found 1 firm(s) without defaultClientId:
      - Firm: FIRM999 (Broken Firm)
   ⚠️  Preflight checks found data inconsistencies (see warnings above)
   ⚠️  These issues should be resolved through data migration
   ✓ System integrity warning email sent to SuperAdmin

   ✓ Bootstrap completed successfully
   ```

4. **Verify firm is NOT auto-healed:**
   ```javascript
   db.firms.findOne({ firmId: 'FIRM999' })
   // Should still have NO defaultClientId
   ```

5. **Check for integrity warning email** (if email configured):
   - SuperAdmin receives "System Integrity Warning" email
   - Email lists violations found

6. **Clean up:**
   ```javascript
   db.firms.deleteOne({ firmId: 'FIRM999' })
   ```

#### Success Criteria

- ✅ Server starts successfully (doesn't crash)
- ✅ Bootstrap logs warning about broken firm
- ✅ Broken firm is NOT auto-fixed
- ✅ Integrity warning email sent
- ✅ Server continues running normally

---

### Test 9: Admin Password Setup Flow ✅

**Objective:** Verify admin can set password after firm creation.

#### Steps

1. **Retrieve password setup token** from admin invite email or database:
   ```javascript
   const admin = db.users.findOne({ xID: 'X000001' })
   // Note: passwordSetupTokenHash is stored, not the token itself
   // Token is sent via email
   ```

2. **Set password using token** (from email):
   ```bash
   curl -X POST http://localhost:5000/api/auth/setup-password \
     -H "Content-Type: application/json" \
     -d '{
       "token": "<setup_token_from_email>",
       "password": "NewSecurePass@123"
     }'
   ```

3. **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Password set successfully. You can now log in."
   }
   ```

4. **Login as admin:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "john.doe@testfirm.com",
       "password": "NewSecurePass@123"
     }'
   ```

5. **Expected Response:**
   ```json
   {
     "success": true,
     "token": "<test-jwt-token>",
     "user": {
       "xID": "X000001",
       "email": "john.doe@testfirm.com",
       "role": "Admin",
       "firmId": "..."
     }
   }
   ```

#### Success Criteria

- ✅ Password setup succeeds
- ✅ Admin can log in with new password
- ✅ Admin has correct role and firmId
- ✅ Admin can access firm-specific endpoints

---

### Test 10: Validation Tests ✅

**Objective:** Verify input validation for firm creation.

#### Test 10a: Missing Firm Name

```bash
curl -X POST http://localhost:5000/api/superadmin/firms \
  -H "Authorization: Bearer <test-auth-token>" \
  -d '{
    "adminName": "Test Admin",
    "adminEmail": "test@test.com"
  }'
```

**Expected:** 400 Bad Request, "Firm name is required"

---

#### Test 10b: Missing Admin Name

```bash
curl -X POST http://localhost:5000/api/superadmin/firms \
  -H "Authorization: Bearer <test-auth-token>" \
  -d '{
    "name": "Test Firm",
    "adminEmail": "test@test.com"
  }'
```

**Expected:** 400 Bad Request, "Admin name is required"

---

#### Test 10c: Invalid Email Format

```bash
curl -X POST http://localhost:5000/api/superadmin/firms \
  -H "Authorization: Bearer <test-auth-token>" \
  -d '{
    "name": "Test Firm",
    "adminName": "Test Admin",
    "adminEmail": "invalid-email"
  }'
```

**Expected:** 400 Bad Request, "Invalid admin email format"

---

#### Success Criteria

- ✅ All validation errors caught before transaction
- ✅ Appropriate error messages returned
- ✅ No data created for invalid requests

---

## Post-Testing Verification

### Database Integrity Check

Run this comprehensive check after all tests:

```javascript
// Count documents
const firmCount = db.firms.countDocuments()
const clientCount = db.clients.countDocuments()
const adminCount = db.users.countDocuments({ role: 'Admin' })

console.log(`Firms: ${firmCount}, Clients: ${clientCount}, Admins: ${adminCount}`)

// Verify each firm has defaultClientId
const brokenFirms = db.firms.find({ 
  $or: [
    { defaultClientId: { $exists: false } },
    { defaultClientId: null }
  ]
}).toArray()

console.log(`Broken firms: ${brokenFirms.length}`)

// Verify each admin has firmId and defaultClientId
const brokenAdmins = db.users.find({ 
  role: 'Admin',
  $or: [
    { firmId: { $exists: false } },
    { firmId: null },
    { defaultClientId: { $exists: false } },
    { defaultClientId: null }
  ]
}).toArray()

console.log(`Broken admins: ${brokenAdmins.length}`)
```

**Expected Results:**
- ✅ 2 firms (FIRM001, FIRM002)
- ✅ 2 clients (one per firm)
- ✅ 2 admins (one per firm)
- ✅ 0 broken firms
- ✅ 0 broken admins

---

## Test Results Summary

After completing all tests, fill in this summary:

| Test | Status | Notes |
|------|--------|-------|
| 1. Empty DB Bootstrap | ⬜ PASS / ⬜ FAIL | |
| 2. SuperAdmin Login | ⬜ PASS / ⬜ FAIL | |
| 3. Firm Creation | ⬜ PASS / ⬜ FAIL | |
| 4. Second Firm | ⬜ PASS / ⬜ FAIL | |
| 5. Transaction Rollback | ⬜ PASS / ⬜ FAIL | |
| 6. Missing firmId Error | ⬜ PASS / ⬜ FAIL | |
| 7. Server Restart | ⬜ PASS / ⬜ FAIL | |
| 8. Integrity Detection | ⬜ PASS / ⬜ FAIL | |
| 9. Password Setup | ⬜ PASS / ⬜ FAIL | |
| 10. Validation Tests | ⬜ PASS / ⬜ FAIL | |

---

## Troubleshooting

### Issue: Server Won't Start

**Symptom:** Error during bootstrap

**Solution:**
1. Check MongoDB connection
2. Verify environment variables
3. Check for syntax errors in code

---

### Issue: Firm Creation Fails

**Symptom:** 500 error when creating firm

**Possible Causes:**
1. Email service not configured (check BREVO_API_KEY)
2. Database connection issue
3. Transaction timeout

**Debug:**
```bash
# Check server logs for detailed error
tail -f logs/server.log

# Verify MongoDB transaction support
db.runCommand({ serverStatus: 1 })
```

---

### Issue: Admin Can't Log In

**Symptom:** Admin login fails after firm creation

**Possible Causes:**
1. Password not set yet (status: INVITED)
2. Token expired
3. Email not received

**Solution:**
1. Check user status: `db.users.findOne({ xID: 'X000001' })`
2. Generate new token if expired
3. Check email logs

---

## Clean-Up After Testing

```javascript
// Delete test firms
db.firms.deleteMany({ firmId: { $in: ['FIRM001', 'FIRM002'] } })

// Delete test clients
db.clients.deleteMany({ clientId: 'C000001' })

// Delete test admins
db.users.deleteMany({ role: 'Admin', xID: { $in: ['X000001'] } })

// Delete test users
db.users.deleteOne({ xID: 'X999999' })

// Verify cleanup
db.firms.countDocuments()   // Should be 0
db.clients.countDocuments() // Should be 0
db.users.countDocuments({ role: 'Admin' }) // Should be 0
```

---

## Sign-Off

**Tester Name:** ___________________________  
**Date:** ___________________________  
**Environment:** ___________________________  
**Result:** ⬜ ALL PASS ⬜ SOME FAILURES

**Notes:**
```
[Add any additional notes or observations here]
```

**Approved for Deployment:** ⬜ YES ⬜ NO

---

## Appendix: Test Data

### Sample Firm Data

```json
{
  "name": "Test Firm Alpha",
  "adminName": "Alice Johnson",
  "adminEmail": "alice@alpha.com"
}
```

```json
{
  "name": "Test Firm Beta",
  "adminName": "Bob Williams",
  "adminEmail": "bob@beta.com"
}
```

### Sample Case Data

```json
{
  "title": "Test Case for Firm",
  "description": "This is a test case",
  "categoryId": "<valid_category_id>",
  "subcategoryId": "<valid_subcategory_id>",
  "clientId": "C000001",
  "slaDueDate": "2026-01-15T00:00:00.000Z",
  "priority": "High"
}
```

---

**End of Testing Guide**
