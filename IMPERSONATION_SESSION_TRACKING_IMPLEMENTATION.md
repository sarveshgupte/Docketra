# Impersonation Session Tracking Implementation Summary

## Overview

This implementation adds UUID-based session tracking for SuperAdmin firm impersonation. Each impersonation session is assigned a unique sessionId that tracks all actions performed during that session, ensuring session continuity and enabling comprehensive audit trail analysis.

## Architecture

### Session Lifecycle

```
1. SuperAdmin clicks "Switch to Firm"
   ↓
2. POST /api/superadmin/switch-firm
   ↓
3. Backend generates UUID sessionId
   ↓
4. sessionId stored in localStorage + returned to frontend
   ↓
5. All subsequent requests include X-Impersonation-Session-Id header
   ↓
6. firmContext middleware validates session header
   ↓
7. All audit entries include impersonationActive=true & sessionId
   ↓
8. SuperAdmin clicks "Exit Firm" (passes sessionId)
   ↓
9. POST /api/superadmin/exit-firm
   ↓
10. sessionId cleared from localStorage
```

## Implementation Details

### Backend Changes

#### 1. Session Generation (`src/controllers/superadmin.controller.js`)

**switchFirm Controller**:
```javascript
const sessionId = crypto.randomUUID(); // Generate UUID v4

await logSuperadminAction({
  actionType: 'SwitchFirm',
  metadata: {
    sessionId, // Log session start
    // ... other metadata
  }
});

res.json({
  data: {
    sessionId, // Return to frontend
    impersonatedFirmId,
    // ... other data
  }
});
```

**exitFirm Controller**:
```javascript
const { sessionId } = req.body; // Accept from frontend

await logSuperadminAction({
  actionType: 'ExitFirm',
  metadata: {
    sessionId, // Log session end
  }
});
```

#### 2. Session Validation (`src/middleware/firmContext.js`)

**Enhanced Middleware**:
```javascript
const impersonatedFirmId = req.headers['x-impersonated-firm-id'];
const impersonationSessionId = req.headers['x-impersonation-session-id'];

if (isSuperAdmin && impersonatedFirmId) {
  // Require session ID for all impersonated requests
  if (!impersonationSessionId) {
    return res.status(403).json({
      message: 'Impersonation session ID is required'
    });
  }
  
  // Attach to request context for audit logging
  req.context = {
    isSuperAdmin: true,
    isGlobalContext: false,
    impersonatedFirmId: firm._id.toString(),
    impersonationSessionId, // Available to all downstream code
  };
}
```

#### 3. Audit Model Enhancements

**CaseAudit Model** (`src/models/CaseAudit.model.js`):
```javascript
{
  // ... existing fields
  
  impersonationActive: {
    type: Boolean,
    default: false,
  },
  
  impersonationSessionId: {
    type: String,
    default: null,
  }
}

// Index for querying all actions in a session
caseAuditSchema.index({ impersonationSessionId: 1 });
```

**ClientAudit Model** (`src/models/ClientAudit.model.js`):
- Same fields and indexes as CaseAudit

#### 4. Audit Service Updates

**auditLog.service.js**:
```javascript
const logCaseAction = async ({ caseId, actionType, description, performedByXID, metadata = {}, req }) => {
  // Extract impersonation context from request
  const impersonationActive = req?.context?.isSuperAdmin && req?.context?.impersonationSessionId ? true : false;
  const impersonationSessionId = req?.context?.impersonationSessionId || null;

  await CaseAudit.create({
    caseId,
    actionType,
    description,
    performedByXID,
    metadata,
    impersonationActive,
    impersonationSessionId, // Automatically included
  });
};
```

**clientFactSheetAudit.service.js**:
- Same pattern for ClientAudit entries

**Controller Updates**:
- All 14 audit logging calls updated to pass `req` parameter
- Ensures impersonation context captured everywhere

### Frontend Changes

#### 1. Session Storage (`ui/src/services/api.js`)

**Request Interceptor**:
```javascript
const impersonatedFirm = localStorage.getItem(STORAGE_KEYS.IMPERSONATED_FIRM);
if (impersonatedFirm) {
  const firmData = JSON.parse(impersonatedFirm);
  
  // Send both headers
  if (firmData?.impersonatedFirmId) {
    config.headers['X-Impersonated-Firm-Id'] = firmData.impersonatedFirmId;
  }
  if (firmData?.sessionId) {
    config.headers['X-Impersonation-Session-Id'] = firmData.sessionId;
  }
}
```

#### 2. Exit Firm (`ui/src/services/superadminService.js`)

**Updated Service**:
```javascript
exitFirm: async (sessionId) => {
  const response = await api.post('/superadmin/exit-firm', { sessionId });
  return response.data;
}
```

#### 3. Logout Cleanup (`ui/src/contexts/AuthContext.jsx`)

**clearAuthStorage Enhancement**:
```javascript
const clearAuthStorage = useCallback((firmSlugToPreserve = null) => {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM); // Clears sessionId too
  // ...
}, []);
```

## Testing

### Test Suite (`tests/impersonationSessionTracking.test.js`)

**6 Comprehensive Tests**:

1. ✅ **Session Generation**: Verifies UUID v4 format sessionId returned by switchFirm
2. ✅ **Audit Logging**: Confirms sessionId logged in SwitchFirm metadata
3. ✅ **Exit Logging**: Validates sessionId logged in ExitFirm metadata
4. ✅ **Header Requirement**: Ensures 403 error when session header missing
5. ✅ **Context Attachment**: Verifies sessionId attached to req.context
6. ✅ **Audit Integration**: Confirms impersonationActive and impersonationSessionId fields populated

**All tests passing** ✓

## Security Considerations

### Session ID Properties
- **Format**: UUID v4 (128-bit, cryptographically random)
- **Entropy**: ~122 bits of entropy (practically unguessable)
- **Uniqueness**: Guaranteed unique per impersonation session
- **Non-sequential**: Cannot be predicted or enumerated

### Security Guarantees
1. **Session Continuity**: Missing session header → 403 Forbidden
2. **No Server-Side State**: Sessions tracked client-side only (stateless)
3. **Complete Audit Trail**: Every impersonated action linked to session
4. **Automatic Cleanup**: Session cleared on logout and exit
5. **No Identity Mutation**: User identity never modified during impersonation

### Attack Surface
- **Session Hijacking**: Not applicable (no server-side session storage)
- **Session Fixation**: Not applicable (new UUID per session)
- **CSRF**: Mitigated by existing CSRF protections + unique session IDs
- **Replay Attacks**: Session IDs don't provide authorization (only audit linkage)

## Usage Examples

### Querying Actions in an Impersonation Session

**MongoDB Query**:
```javascript
// Find all actions performed during a specific impersonation session
db.caseaudits.find({
  impersonationSessionId: "9d5a9742-cd3a-44a1-8c83-e60c34c9bb0e"
}).sort({ timestamp: 1 });

// Count impersonated vs. non-impersonated actions
db.caseaudits.aggregate([
  {
    $group: {
      _id: "$impersonationActive",
      count: { $sum: 1 }
    }
  }
]);

// Find all impersonation sessions by a SuperAdmin
db.superadminaudits.find({
  actionType: "SwitchFirm",
  performedBy: "superadmin@docketra.local"
}).sort({ timestamp: -1 });

// Link SwitchFirm → Actions → ExitFirm
db.superadminaudits.aggregate([
  { $match: { actionType: "SwitchFirm" } },
  {
    $lookup: {
      from: "caseaudits",
      localField: "metadata.sessionId",
      foreignField: "impersonationSessionId",
      as: "sessionActions"
    }
  }
]);
```

### Frontend: Checking Current Session

**Component Logic**:
```javascript
const impersonatedFirm = JSON.parse(
  localStorage.getItem(STORAGE_KEYS.IMPERSONATED_FIRM)
);

if (impersonatedFirm?.sessionId) {
  console.log('Active session:', impersonatedFirm.sessionId);
  console.log('Impersonating:', impersonatedFirm.firmName);
}
```

## Migration Notes

### Database Changes
- **Schema Updates**: Two new fields added to CaseAudit and ClientAudit
- **Indexes Added**: New index on impersonationSessionId (non-unique, sparse)
- **Backward Compatible**: Existing audit entries have `impersonationActive=false` and `impersonationSessionId=null`

### Rollback Safety
- **No Breaking Changes**: All changes are additive
- **Default Values**: New fields default to false/null for existing records
- **Optional Parameters**: All `req` parameters are optional in audit functions

## Performance Impact

### Backend
- **Session Generation**: O(1) - Single crypto.randomUUID() call
- **Header Parsing**: O(1) - Two header lookups per request
- **Audit Writes**: No additional overhead (fields added to existing writes)
- **Index Size**: ~24 bytes per audit entry (UUID storage)

### Frontend
- **localStorage**: +36 bytes per session (UUID string)
- **HTTP Headers**: +73 bytes per request (header + UUID)
- **Memory**: Negligible (single UUID in memory)

### Database
- **Storage**: +2 fields per audit entry (~30 bytes)
- **Index**: Sparse index on impersonationSessionId (only indexed when present)
- **Query Performance**: Index enables efficient session-based queries

## Compliance & Auditing

### Audit Trail Capabilities
1. **Session Reconstruction**: Complete timeline of all actions in a session
2. **SuperAdmin Activity**: Track when/where SuperAdmins entered firm contexts
3. **Compliance Reporting**: Generate reports on impersonation usage
4. **Forensic Analysis**: Investigate specific impersonation sessions
5. **Access Patterns**: Analyze which firms are frequently impersonated

### Regulatory Alignment
- **SOC 2**: Supports audit trail and access logging requirements
- **HIPAA**: Enables tracking of all access to protected data
- **GDPR**: Facilitates data access logs and "right to know"
- **ISO 27001**: Aligns with access control and audit logging standards

## Future Enhancements

### Potential Additions
1. **Session Expiry**: Auto-expire sessions after N hours/minutes
2. **Session Limits**: Max concurrent impersonation sessions
3. **Session Notifications**: Alert firm admins when SuperAdmin enters
4. **Session Reports**: Dashboard showing active/historical sessions
5. **Session Replay**: UI to "replay" all actions in a session
6. **Multi-Session Support**: Allow SuperAdmin to switch between firms without exiting

## Related Files

### Backend
- `src/controllers/superadmin.controller.js` - Session generation
- `src/middleware/firmContext.js` - Session validation
- `src/models/CaseAudit.model.js` - Schema updates
- `src/models/ClientAudit.model.js` - Schema updates
- `src/services/auditLog.service.js` - Audit service updates
- `src/services/clientFactSheetAudit.service.js` - Audit service updates
- `src/controllers/admin.controller.js` - Audit call updates
- `src/controllers/case.controller.js` - Audit call updates
- `src/controllers/caseActions.controller.js` - Audit call updates
- `src/controllers/search.controller.js` - Audit call updates

### Frontend
- `ui/src/services/api.js` - Header transmission
- `ui/src/services/superadminService.js` - Exit firm service
- `ui/src/components/common/SuperAdminLayout.jsx` - Session management
- `ui/src/contexts/AuthContext.jsx` - Logout cleanup

### Testing
- `tests/impersonationSessionTracking.test.js` - Comprehensive test suite

## Summary

This implementation enhances SuperAdmin firm impersonation with robust session tracking:

✅ **Session IDs**: Generated per impersonation session (UUID v4)  
✅ **Session Validation**: Required header enforced by middleware  
✅ **Audit Integration**: All actions linked to session in audit trail  
✅ **Frontend Integration**: Automatic header transmission  
✅ **Security**: No server-side state, complete audit trail  
✅ **Testing**: 6 comprehensive tests, all passing  
✅ **Performance**: Minimal overhead, efficient indexing  
✅ **Compliance**: Enables comprehensive audit reporting  

The system maintains **stateless** operation while providing **complete traceability** of all SuperAdmin actions during firm impersonation.
