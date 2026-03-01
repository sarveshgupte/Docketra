# Implementation Testing Guide

## Overview
This document provides comprehensive testing instructions for the authentication, identity hardening, user profile management, password governance, deterministic case naming, and duplicate client detection implementation.

## Prerequisites
1. MongoDB connection (local or remote)
2. Node.js installed
3. .env file configured with MONGODB_URI
4. Server running on configured port (default: 3000)

## Test Setup

### 1. Create Environment File
```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/docketra
APP_NAME=Docketra
```

### 2. Start Server
```bash
npm install
npm start
```

## PART A - Authentication & Access Control Tests

### Test 1.1: Public Login Endpoint
```bash
# Should succeed - login is public
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "xID": "X123456",
    "password": "ChangeMe@123"
  }'
```
**Expected**: Success with user data returned

### Test 1.2: Protected Endpoints Without Authentication
```bash
# Should fail with 401 - no authentication
curl -X GET http://localhost:3000/api/cases
```
**Expected**: 401 Unauthorized error

### Test 1.3: Protected Endpoints With Authentication
```bash
# Should succeed - authentication provided
curl -X GET http://localhost:3000/api/cases \
  -H "x-user-id: X123456"
```
**Expected**: Success with cases list

### Test 1.4: Inactive User Access
```bash
# First deactivate a user (requires admin)
# Then try to access with deactivated user's xID
curl -X GET http://localhost:3000/api/cases \
  -H "x-user-id: X999999"
```
**Expected**: 403 Forbidden if user is inactive

## PART B - User Identity & Password Governance Tests

### Test 2.1: Admin Creates User
```bash
curl -X POST http://localhost:3000/api/auth/admin/users \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "xID": "X100001",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "Employee",
    "allowedCategories": ["Category1"]
  }'
```
**Expected**: User created with default password "ChangeMe@123"

### Test 2.2: First Login Requires Password Change
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "xID": "X100001",
    "password": "ChangeMe@123"
  }'
```
**Expected**: 403 with requirePasswordChange: true

### Test 2.3: Change Password
```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "x-user-id: X100001" \
  -d '{
    "currentPassword": "ChangeMe@123",
    "newPassword": "MyNewPassword123!"
  }'
```
**Expected**: Success message

### Test 2.4: Cannot Reuse Last 5 Passwords
```bash
# Change password 5 times
# Try to change back to first password
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "x-user-id: X100001" \
  -d '{
    "currentPassword": "CurrentPassword",
    "newPassword": "ChangeMe@123"
  }'
```
**Expected**: 400 error - "Cannot reuse any of your last 5 passwords"

### Test 2.5: Admin Password Reset
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "xID": "X100001"
  }'
```
**Expected**: Success, user must change password on next login

### Test 2.6: xID and Name Immutability
Try to update user with mongoose directly (in mongo shell):
```javascript
db.users.updateOne(
  { xID: "X100001" },
  { $set: { xID: "X999999", name: "Different Name" } }
)
```
**Expected**: Error due to immutable field constraints

## PART C - User Profile Tests

### Test 3.1: Get User Profile
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "x-user-id: X100001"
```
**Expected**: User profile with immutable (xID, name, role) and mutable fields

### Test 3.2: Update Profile
```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "x-user-id: X100001" \
  -d '{
    "phone": "1234567890",
    "email": "newemail@example.com",
    "address": {
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    },
    "pan": "ABCDE1234F",
    "aadhaar": "123456789012"
  }'
```
**Expected**: Success with updated profile

### Test 3.3: Verify Audit Log Created
Query AuthAudit collection:
```javascript
db.authaudits.find({ xID: "X100001", actionType: "ProfileUpdated" }).pretty()
```
**Expected**: Audit entry with old and new values in metadata

## PART D - Audit & Tamper Proofing Tests

### Test 4.1: Verify Audit Logs Created
```javascript
// Check various audit types
db.authaudits.find({ actionType: "UserCreated" }).pretty()
db.authaudits.find({ actionType: "Login" }).pretty()
db.authaudits.find({ actionType: "PasswordChanged" }).pretty()
db.authaudits.find({ actionType: "ProfileUpdated" }).pretty()
```
**Expected**: Audit entries for all actions

### Test 4.2: Attempt to Update Audit Log
```javascript
db.authaudits.updateOne(
  { actionType: "Login" },
  { $set: { description: "Modified" } }
)
```
**Expected**: Error - "Audit logs cannot be updated"

### Test 4.3: Attempt to Delete Audit Log
```javascript
db.authaudits.deleteOne({ actionType: "Login" })
```
**Expected**: Error - "Audit logs cannot be deleted"

## PART E - Case Naming Tests

### Test 5.1: Create First Case of the Day
```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "title": "Test Case 1",
    "description": "Testing case name generation",
    "category": "Test Category",
    "clientId": "C123456",
    "createdBy": "admin@example.com"
  }'
```
**Expected**: Case created with caseName like "case2026010700001"

### Test 5.2: Create Second Case Same Day
```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "title": "Test Case 2",
    "description": "Testing sequential naming",
    "category": "Test Category",
    "clientId": "C123456",
    "createdBy": "admin@example.com"
  }'
```
**Expected**: Case created with caseName like "case2026010700002"

### Test 5.3: Verify Case Name Format
```javascript
db.cases.find({}, { caseName: 1, caseId: 1 }).pretty()
```
**Expected**: All cases have caseName in format "caseYYYYMMDDxxxxx"

### Test 5.4: Verify Case Name Uniqueness
```javascript
db.cases.aggregate([
  { $group: { _id: "$caseName", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```
**Expected**: Empty result (no duplicates)

## PART F - Duplicate Client Detection Tests

### Test 6.1: Create Client for Testing
```bash
# First create a client
curl -X POST http://localhost:3000/api/client-approval \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "businessName": "Test Company Ltd",
    "businessAddress": "123 Test Street, Mumbai",
    "businessPhone": "9876543210",
    "businessEmail": "test@company.com",
    "PAN": "TESTPAN123",
    "GST": "TESTGST456",
    "CIN": "TESTCIN789"
  }'
```

### Test 6.2: Attempt to Create "Client – New" Case Without Duplicate Detection
```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "title": "New Client Onboarding",
    "category": "Client – New",
    "clientId": "C123456",
    "createdBy": "admin@example.com",
    "clientData": {
      "businessName": "Test Company Ltd",
      "businessAddress": "123 Test Street, Mumbai",
      "businessPhone": "9876543210",
      "businessEmail": "test@company.com",
      "PAN": "TESTPAN123"
    }
  }'
```
**Expected**: 409 Conflict with duplicate matches

### Test 6.3: Create with Fuzzy Match
```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "title": "New Client Onboarding",
    "category": "Client – New",
    "clientId": "C123456",
    "createdBy": "admin@example.com",
    "clientData": {
      "businessName": "Test Company Limited",
      "businessAddress": "123 Test St Mumbai"
    }
  }'
```
**Expected**: 409 Conflict with fuzzy matches on name/address

### Test 6.4: Override Duplicate Warning
```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "title": "New Client Onboarding",
    "category": "Client – New",
    "clientId": "C123456",
    "createdBy": "admin@example.com",
    "forceCreate": true,
    "clientData": {
      "businessName": "Test Company Ltd",
      "PAN": "TESTPAN123"
    }
  }'
```
**Expected**: 201 Created with system comment added

### Test 6.5: Verify System Comment
```bash
curl -X GET http://localhost:3000/api/cases/{caseId} \
  -H "x-user-id: X123456"
```
**Expected**: Case with comment from "system" containing duplicate warning

### Test 6.6: Duplicate Detection NOT Applied to Other Categories
```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -H "x-user-id: X123456" \
  -d '{
    "title": "Regular Case",
    "category": "Other Category",
    "clientId": "C123456",
    "createdBy": "admin@example.com"
  }'
```
**Expected**: 201 Created without duplicate check (only applies to "Client – New")

## Integration Tests

### Test 7.1: Complete User Lifecycle
1. Admin creates user
2. User logs in (forced to change password)
3. User changes password
4. User updates profile
5. User accesses protected resources
6. Verify all audit logs created

### Test 7.2: Complete Case Lifecycle with Duplicate Detection
1. Create first client
2. Create "Client – New" case (should pass)
3. Attempt to create another with similar data (should get 409)
4. Override with forceCreate=true
5. Verify system comment added
6. Verify case has proper caseName

## Verification Checklist

- [ ] All non-auth endpoints return 401 without authentication
- [ ] Only POST /api/auth/login is public
- [ ] xID and name cannot be modified via any API or direct DB update
- [ ] Password expires at 60 days (check passwordExpiresAt field)
- [ ] Password history prevents reuse of last 5 passwords
- [ ] Profile changes create audit entries with old/new values
- [ ] Case names generated in format caseYYYYMMDDxxxxx
- [ ] Case name sequence resets daily
- [ ] Duplicate detection works only for "Client – New" cases
- [ ] System comments added when override is used
- [ ] Admin can create users with default password
- [ ] Users forced to change password on first login
- [ ] Audit logs are append-only (cannot update or delete)

## Security Validation

### Password Security
```javascript
// Verify passwords are hashed
db.users.find({}, { xID: 1, passwordHash: 1 }).pretty()
// passwordHash should be bcrypt hash (starts with $2b$)

// Verify password history stored
db.users.find({}, { xID: 1, passwordHistory: 1 }).pretty()
// passwordHistory should contain hashed values
```

### Immutability Checks
```javascript
// xID immutability
db.users.updateOne({ xID: "X100001" }, { $set: { xID: "X999999" } })
// Should fail

// name immutability
db.users.updateOne({ xID: "X100001" }, { $set: { name: "New Name" } })
// Should fail

// Audit immutability
db.authaudits.updateOne({}, { $set: { description: "Modified" } })
// Should fail
```

## Troubleshooting

### Issue: Cannot connect to MongoDB
**Solution**: Check MONGODB_URI in .env, ensure MongoDB is running

### Issue: 401 on all endpoints
**Solution**: Ensure x-user-id header is provided, user exists and is active

### Issue: Case name not generated
**Solution**: Check Case model pre-save hook, ensure services directory exists

### Issue: Duplicate detection not working
**Solution**: Ensure category is exactly "Client – New" or "Client - New"

## Notes

1. **Authentication**: Current implementation uses x-user-id header. In production, use JWT tokens.
2. **Case Names**: Daily sequence requires server time to be accurate.
3. **Duplicate Detection**: Fuzzy matching threshold is 80% similarity.
4. **Password Expiry**: Set to 60 days from last password change.
5. **Audit Logs**: Check regularly for completeness and accuracy.
