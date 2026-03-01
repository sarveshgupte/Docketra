# SuperAdmin Firm Switching Implementation

## 🎯 Overview

This implementation adds **explicit firm context switching** for SuperAdmin users, enabling them to safely impersonate firms for debugging, support, and setup purposes.

## 🏗️ Architecture

### Key Design Principles

1. **Explicit Context Selection**: Firm context is never implicit - it must be explicitly selected
2. **Non-Persistent by Default**: Impersonation state is stored in browser localStorage (session-based)
3. **Auditable**: All switching actions are logged in SuperadminAudit
4. **Reversible**: SuperAdmin can exit firm context at any time
5. **Safe**: Clear visual indicators prevent dangerous mistakes

### Two Modes of Operation

| Mode         | firmId     | scope    | Access                    |
| ------------ | ---------- | -------- | ------------------------- |
| GLOBAL       | `null`     | `GLOBAL` | Platform management only  |
| IMPERSONATED | `<firmId>` | `FIRM`   | Firm-scoped routes access |

## 📦 Implementation Details

### Backend Components

#### 1. New Routes

```javascript
POST /api/superadmin/switch-firm
POST /api/superadmin/exit-firm
```

**Authentication**: Requires SuperAdmin role
**Rate Limiting**: Protected by superadminLimiter

#### 2. Controller Functions

**`switchFirm(req, res)`**
- Validates firm exists
- Logs impersonation to SuperadminAudit
- Returns firm context information
- Does NOT mutate user identity or JWT

**`exitFirm(req, res)`**
- Logs exit action to SuperadminAudit
- Returns to GLOBAL context
- Clears impersonation state

#### 3. Audit Logging

New action types added to SuperadminAudit:
- `SwitchFirm`: When SuperAdmin enters firm context
- `ExitFirm`: When SuperAdmin exits firm context

Each log includes:
```javascript
{
  actionType: 'SwitchFirm',
  performedBy: 'superadmin@docketra.local',
  performedById: ObjectId('...'),
  targetEntityType: 'Firm',
  targetEntityId: 'firmId',
  metadata: {
    firmId: 'FIRM001',
    firmSlug: 'test-firm',
    fromContext: 'GLOBAL',
    toContext: 'FIRM'
  }
}
```

#### 4. Firm Context Middleware Enhancement

The `firmContext` middleware now:
1. Checks for `X-Impersonated-Firm-Id` header
2. Blocks SuperAdmin access WITHOUT impersonation header
3. Allows SuperAdmin access WITH valid impersonation header
4. Attaches impersonation context to request:

```javascript
req.context = {
  isSuperAdmin: true,
  isGlobalContext: false,
  impersonatedFirmId: firm._id
}
```

### Frontend Components

#### 1. FirmSwitcher Component

**Location**: `ui/src/components/common/FirmSwitcher.jsx`

**Features**:
- Dropdown showing all active firms
- Calls `/api/superadmin/switch-firm`
- Updates local state and localStorage
- Only shown to SuperAdmin users

**Usage**:
```jsx
<FirmSwitcher onFirmSwitch={handleFirmSwitch} />
```

#### 2. ImpersonationBanner Component

**Location**: `ui/src/components/common/ImpersonationBanner.jsx`

**Features**:
- Sticky banner at top of page
- Displays impersonated firm name
- "Exit Firm" button
- Prominent styling to prevent mistakes

**Visual Design**:
- Red/orange gradient background
- Lock icon (🔒)
- Pulsing animation for visibility

#### 3. API Client Integration

**Location**: `ui/src/services/api.js`

The axios interceptor automatically adds the impersonation header:

```javascript
const impersonatedFirm = localStorage.getItem(STORAGE_KEYS.IMPERSONATED_FIRM);
if (impersonatedFirm) {
  const firmData = JSON.parse(impersonatedFirm);
  config.headers['X-Impersonated-Firm-Id'] = firmData.impersonatedFirmId;
}
```

#### 4. Storage Management

**Location**: `ui/src/utils/constants.js`

New storage key:
```javascript
STORAGE_KEYS.IMPERSONATED_FIRM = 'impersonatedFirm'
```

Stored data structure:
```javascript
{
  impersonatedFirmId: '507f1f77bcf86cd799439011',
  firmId: 'FIRM001',
  firmSlug: 'test-firm',
  firmName: 'Test Firm',
  firmStatus: 'ACTIVE'
}
```

## 🧪 Testing

### Backend Tests

**File**: `tests/superadminFirmSwitching.test.js`

Tests:
- ✅ SuperAdmin can switch into firm context
- ✅ Invalid firmId returns 404
- ✅ Missing firmId returns 400
- ✅ Exit firm returns to GLOBAL context
- ✅ Switching using FIRM001 format works
- ✅ Audit logs are created correctly

**File**: `tests/firmContextImpersonation.test.js`

Tests:
- ✅ SuperAdmin blocked without impersonation header
- ✅ SuperAdmin allowed with impersonation header
- ✅ Regular admin access still works normally
- ✅ Invalid impersonation firm ID returns error
- ✅ Impersonation context properly attached

### Running Tests

```bash
# Run firm switching tests
node tests/superadminFirmSwitching.test.js

# Run firm context middleware tests
node tests/firmContextImpersonation.test.js

# Run all tests
npm run test:integrity
```

## 🔒 Security Considerations

### 1. Authorization
- Only SuperAdmin role can access switching endpoints
- Middleware validates SuperAdmin status before allowing impersonation
- Regular users cannot impersonate firms

### 2. Validation
- Firm existence is validated before switching
- Firm status is checked (must be ACTIVE)
- Invalid firm IDs are rejected

### 3. Audit Trail
- All switching actions are logged
- Includes actor, target firm, timestamp, IP, user agent
- Logs are immutable (append-only)

### 4. Visual Safety
- Impersonation banner prevents accidental actions
- Clear indication of which firm is being impersonated
- Easy exit mechanism

### 5. State Management
- Impersonation state is session-based (localStorage)
- Cleared on logout
- Not persisted in JWT or database

## 📝 Usage Guide

### For SuperAdmin

#### Switching to a Firm

1. Click "Switch to Firm" button in the navigation bar
2. Select a firm from the dropdown
3. Impersonation banner appears at top
4. Firm-scoped routes become accessible

#### Exiting Firm Context

1. Click "Exit Firm" button in the impersonation banner
2. Returns to GLOBAL context
3. Firm-scoped routes become inaccessible again

#### What You Can Do While Impersonating

- Access all firm-scoped routes (cases, clients, tasks, etc.)
- Perform actions on behalf of the firm
- View firm-specific data
- Debug issues

#### What You Cannot Do

- Permanently modify your user identity
- Access multiple firms simultaneously
- Bypass firm ownership checks (still validated)

### For Developers

#### Adding New Firm-Scoped Routes

No changes needed! The firmContext middleware automatically:
1. Detects SuperAdmin
2. Checks for impersonation header
3. Validates and attaches firm context

#### Checking Impersonation Context

```javascript
// In your controller
if (req.context?.isSuperAdmin && req.context?.impersonatedFirmId) {
  // SuperAdmin is impersonating
  console.log('Impersonating firm:', req.context.impersonatedFirmId);
}
```

## 🚀 Future Enhancements

### Potential Additions

1. **Time-Limited Impersonation**
   - Auto-expire after N hours
   - Require re-authentication for extended sessions

2. **Permission Restrictions**
   - Limit which actions SuperAdmin can perform while impersonating
   - Read-only mode option

3. **Multi-Firm Support**
   - Switch between multiple firms without exiting
   - Firm comparison views

4. **Enhanced Audit Trail**
   - Track all actions performed during impersonation
   - Generate impersonation session reports

5. **Notification System**
   - Alert firm admins when SuperAdmin enters their context
   - Compliance tracking

## 📊 Metrics

### Audit Queries

```javascript
// Find all firm switches by a specific SuperAdmin
SuperadminAudit.find({
  actionType: 'SwitchFirm',
  performedBy: 'superadmin@docketra.local'
});

// Find all impersonations for a specific firm
SuperadminAudit.find({
  actionType: 'SwitchFirm',
  targetEntityId: firmId
});

// Count impersonation sessions today
SuperadminAudit.countDocuments({
  actionType: 'SwitchFirm',
  timestamp: { $gte: startOfDay, $lte: endOfDay }
});
```

## ✅ Compliance

This implementation ensures:
- ✅ All impersonation actions are auditable
- ✅ Clear visual indicators prevent accidents
- ✅ Explicit consent (button click) required
- ✅ State is non-persistent and session-based
- ✅ Can be disabled via feature flags if needed
- ✅ Firm admins can review audit logs

## 🔗 Related Documentation

- `AUTHORIZATION_IMPLEMENTATION_SUMMARY.md` - Overall authorization system
- `MULTI_TENANCY_SECURITY.md` - Multi-tenancy architecture
- `PR_SUPERADMIN_IMPLEMENTATION_SUMMARY.md` - SuperAdmin role implementation

## 📌 Summary

This PR adds the critical "bridge" between GLOBAL and FIRM contexts for SuperAdmin users:

- ✅ Architecturally sound
- ✅ Audit-safe
- ✅ Extensible
- ✅ Enterprise-ready
- ✅ Prevents future technical debt

The firm context is **always explicit** - never implicit. This single rule prevents auth bugs, audit gaps, security leaks, and mental overhead for future contributors.
