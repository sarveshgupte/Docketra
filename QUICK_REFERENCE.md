# Quick Reference - Global Search, Worklists & xID Authentication

## API Endpoints Cheat Sheet

### Part A: Search & Worklists

#### Global Search
```bash
GET /api/search?q=<searchTerm>&email=<userEmail>
```
**Returns:** Cases matching search term across all searchable fields

#### Category Worklist
```bash
GET /api/worklists/category/<categoryId>?email=<userEmail>
```
**Returns:** Cases in category (excludes Pending)

#### Employee Worklist
```bash
GET /api/worklists/employee/me?email=<userEmail>
```
**Returns:** Cases assigned to user (excludes Pending, no caseId)

---

### Part B: Authentication

#### Login
```bash
POST /api/auth/login
Body: { "xID": "X123456", "password": "password" }
```

#### Logout
```bash
POST /api/auth/logout
Body: { "xID": "X123456" }
```

#### Change Password
```bash
POST /api/auth/change-password
Body: {
  "xID": "X123456",
  "currentPassword": "old",
  "newPassword": "new"
}
```

#### Reset Password (Admin)
```bash
POST /api/auth/reset-password
Body: {
  "xID": "X123456",
  "adminXID": "X000001"
}
```

#### Get Profile
```bash
GET /api/auth/profile?xID=X123456
```

#### Update Profile
```bash
PUT /api/auth/profile
Body: {
  "xID": "X123456",
  "phone": "555-0123",
  "email": "user@example.com",
  "address": { ... }
}
```

#### Create User (Admin)
```bash
POST /api/auth/admin/users
Body: {
  "xID": "X123456",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "Employee",
  "allowedCategories": ["Litigation"],
  "adminXID": "X000001"
}
```

#### Activate/Deactivate User (Admin)
```bash
PUT /api/auth/admin/users/X123456/activate
Body: { "adminXID": "X000001" }

PUT /api/auth/admin/users/X123456/deactivate
Body: { "adminXID": "X000001" }
```

---

## Models Reference

### User Model
```javascript
{
  xID: String,              // X123456 (immutable)
  name: String,             // Full name (immutable)
  email: String,            // Contact email (optional)
  role: String,             // Admin | Employee
  allowedCategories: [String],
  isActive: Boolean,
  passwordHash: String,
  passwordLastChangedAt: Date,
  passwordExpiresAt: Date,
  passwordHistory: [{ hash, changedAt }],
  mustChangePassword: Boolean,
  createdAt: Date
}
```

### UserProfile Model
```javascript
{
  xID: String,              // Reference to User
  dob: Date,
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  pan: String,
  aadhaar: String,
  email: String,
  updatedAt: Date
}
```

### AuthAudit Model
```javascript
{
  xID: String,
  actionType: String,       // UserCreated, Login, Logout, etc.
  description: String,
  performedBy: String,      // xID of performer
  ipAddress: String,
  timestamp: Date,
  metadata: Mixed
}
```

---

## Constants

### Password Policy
- Default Password: `ChangeMe@123`
- Salt Rounds: `10`
- Expiry Days: `60`
- History Limit: `5`

### xID Format
- Pattern: `/^X\d{6}$/`
- Example: `X123456`

### User Roles
- `Admin` - Full access
- `Employee` - Restricted access

### Case Statuses
- `Open` - Active
- `Pending` - Waiting (excluded from worklists)
- `Closed` - Completed
- `Filed` - Archived
- `Archived` - Historical

### Audit Action Types
- `UserCreated`
- `Login`
- `LoginFailed`
- `Logout`
- `PasswordChanged`
- `PasswordResetByAdmin`
- `PasswordExpired`
- `ProfileUpdated`
- `AccountActivated`
- `AccountDeactivated`

---

## Key Rules

### Visibility Rules
- **Admin**: Sees ALL cases
- **Employee**: Sees cases where:
  - Assigned to them (assignedTo = email), OR
  - Category in allowedCategories

### Worklist Rules
- Category Worklist: Excludes `status === 'Pending'`
- Employee Worklist: Excludes `status === 'Pending'`
- Employee Worklist: Does NOT return `caseId` field

### Immutability Rules
- **User.xID**: Cannot be changed
- **User.name**: Cannot be changed
- **AuthAudit**: Cannot be updated or deleted

### Password Rules
- Must change on first login
- Cannot reuse last 5 passwords
- Expires after 60 days
- Must be different from current

---

## Error Codes

- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid credentials)
- `403` - Forbidden (insufficient permissions, expired password)
- `404` - Not Found (user/resource not found)
- `500` - Server Error

---

## Response Format

All endpoints return:
```json
{
  "success": true|false,
  "message": "Description",
  "data": { ... }
}
```

---

## Database Indexes

### Case
- caseId (unique)
- category
- status
- createdAt (desc)
- assignedTo + status

### Comment
- caseId + createdAt
- text (text index)

### Attachment
- caseId + createdAt
- fileName (text index)

### User
- xID (unique)
- role
- isActive

### UserProfile
- xID (unique)

### AuthAudit
- xID
- xID + timestamp
- actionType

---

## Testing Quick Start

1. **Start MongoDB**
2. **Configure .env**
   ```
   MONGODB_URI=mongodb://localhost:27017/docketra
   PORT=3000
   ```
3. **Start Server**
   ```bash
   npm start
   ```
4. **Create Admin User** (via MongoDB)
   ```javascript
   db.users.insertOne({
     xID: "X000001",
     name: "Admin User",
     email: "admin@example.com",
     role: "Admin",
     allowedCategories: [],
     isActive: true,
     passwordHash: "$2b$10$...",  // Hash of ChangeMe@123
     passwordExpiresAt: new Date("2026-03-01"),
     mustChangePassword: true,
     createdAt: new Date()
   })
   ```
5. **Test Endpoints** (see TESTING_GUIDE.md)

---

## Common Issues

### Issue: Text index not found
**Solution**: MongoDB is still building indexes. Use fallback regex search temporarily.

### Issue: Duplicate index warning
**Solution**: Removed duplicate indexes. Fields with `unique: true` are auto-indexed.

### Issue: bcrypt not found
**Solution**: Run `npm install` to install dependencies.

### Issue: Password expired
**Solution**: Change password using `/api/auth/change-password` endpoint.

### Issue: Must change password
**Solution**: Use `/api/auth/change-password` with default password `ChangeMe@123`.

---

## Files Structure

```
src/
├── models/
│   ├── User.model.js         ✅ Updated
│   ├── UserProfile.model.js  ✅ NEW
│   ├── AuthAudit.model.js    ✅ NEW
│   ├── Case.model.js         ✅ Updated
│   ├── Comment.model.js      ✅ Updated
│   └── Attachment.model.js   ✅ Updated
├── controllers/
│   ├── search.controller.js  ✅ NEW
│   └── auth.controller.js    ✅ NEW
├── routes/
│   ├── search.routes.js      ✅ NEW
│   └── auth.routes.js        ✅ NEW
├── middleware/
│   ├── auth.middleware.js    ✅ NEW
│   └── permission.middleware.js ✅ NEW
└── server.js                 ✅ Updated
```

---

## Support

- Full Documentation: `IMPLEMENTATION_COMPLETE.md`
- Testing Guide: `/tmp/TESTING_GUIDE.md`
- Implementation Details: `/tmp/IMPLEMENTATION_SUMMARY.md`
