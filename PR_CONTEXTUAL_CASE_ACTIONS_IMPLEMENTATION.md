# PR: Contextual Case Actions in View Mode

## 🎯 Objective

Improve usability of the Case View (Read-Only Mode) by adding clear, contextual actions while preserving all existing assignment and worklist rules.

## 📋 Summary

This PR adds two contextual action buttons to the Case Detail page:

1. **Pull Case Button** - Allows users to pull an unassigned case directly from view mode
2. **Move to Global Worklist Button** - Allows admins to move any case back to the global worklist

## 🎨 UI Changes

![UI Mockup](https://github.com/user-attachments/assets/2434e66d-3424-4247-8838-5f3c93b3cd92)

### Button Visibility Logic

| Scenario | User Role | Case State | Pull Case Button | Move to Global Button | View-Only Badge |
|----------|-----------|------------|------------------|----------------------|-----------------|
| Unassigned case in view mode | Employee | `assignedToXID=null`, `queueType=GLOBAL`, `status=UNASSIGNED` | ✅ Visible | ❌ Hidden | ✅ Visible |
| Unassigned case in view mode | Admin | `assignedToXID=null`, `queueType=GLOBAL`, `status=UNASSIGNED` | ✅ Visible | ✅ Visible | ✅ Visible |
| Assigned case (viewing someone else's) | Employee | `assignedToXID!=currentUser` | ❌ Hidden | ❌ Hidden | ✅ Visible |
| Assigned case (viewing someone else's) | Admin | `assignedToXID!=currentUser` | ❌ Hidden | ✅ Visible | ✅ Visible |
| Own case | Any | `assignedToXID=currentUser` | ❌ Hidden | ❌ Hidden | ❌ Hidden |

## 🔧 Technical Implementation

### Backend Changes

#### 1. New Endpoint: `POST /api/cases/:caseId/unassign`

**Purpose:** Move case to global worklist (admin only)

**Authorization:** Admin role required

**Actions:**
- Sets `assignedToXID = null`
- Sets `queueType = 'GLOBAL'`
- Sets `status = 'UNASSIGNED'`
- Clears `assignedAt`
- Creates audit log entries (CaseAudit + CaseHistory)

**Files Modified:**
- `src/controllers/case.controller.js` - Added `unassignCase` function
- `src/routes/case.routes.js` - Added route for unassign endpoint

**Security:**
- Authentication enforced via middleware at router level
- Admin role check in controller
- Audit logging for all unassign actions
- No sensitive error details exposed to client

### Frontend Changes

#### 1. Service Methods

**File:** `ui/src/services/caseService.js`

Added two new methods:
- `pullCase(caseId)` - Pulls a single case using existing `/cases/pull` endpoint
- `moveCaseToGlobal(caseId)` - Calls new `/cases/:caseId/unassign` endpoint

#### 2. UI Components

**File:** `ui/src/pages/CaseDetailPage.jsx`

**New State Variables:**
- `pullingCase` - Tracks pull case operation status
- `movingToGlobal` - Tracks move to global operation status

**New Handlers:**
- `handlePullCase()` - Handles pull case action with confirmation
- `handleMoveToGlobal()` - Handles move to global with confirmation

**Button Rendering Logic:**
```javascript
// Pull Case button visibility
const showPullButton = isViewOnlyMode && 
                        !caseInfo.assignedToXID && 
                        caseInfo.queueType === 'GLOBAL' &&
                        caseInfo.status === 'UNASSIGNED';

// Move to Global button visibility
const showMoveToGlobalButton = isAdmin;
```

**UI Placement:**
- Buttons placed in case header, before badges
- Pull Case uses primary styling (blue)
- Move to Global uses warning styling (orange border)
- Both buttons disabled during operations to prevent double-clicks

**User Experience:**
- Confirmation dialogs for both actions
- Success messages via alert
- Error messages sanitized (no technical details exposed)
- Page reloads after successful action to update UI
- Loading states shown on buttons during operations

## 🔒 Security Considerations

1. **Authentication:** All endpoints protected by authentication middleware
2. **Authorization:** Admin-only actions enforced in backend
3. **Error Sanitization:** Error messages limited to 200 chars and type-checked
4. **Audit Logging:** All actions logged with xID attribution
5. **No Information Disclosure:** Technical error details not sent to client

## ✅ Acceptance Criteria

- [x] Unassigned case in View Mode shows Pull Case button
- [x] Pull button hidden for assigned cases
- [x] Admin users always see Move to Global Worklist button
- [x] Non-admin users never see Move to Global Worklist button
- [x] Actions update case state immediately after success
- [x] No changes to existing worklist or dashboard logic
- [x] Proper confirmation dialogs for both actions
- [x] User-friendly success/error messages
- [x] Buttons disabled during operations
- [x] Role-based visibility enforced in both UI and backend
- [x] Audit logs created for all actions

## 🧪 Testing Notes

### Manual Testing Scenarios

1. **Test Pull Case (Employee)**
   - Login as non-admin user
   - Navigate to Global Worklist
   - Click "View" on an unassigned case
   - Verify "Pull Case" button is visible
   - Click "Pull Case" and confirm
   - Verify case is assigned and button disappears

2. **Test Move to Global (Admin)**
   - Login as admin user
   - Navigate to any case (assigned or unassigned)
   - Verify "Move to Global Worklist" button is visible
   - Click button and confirm
   - Verify case moves to global worklist with UNASSIGNED status

3. **Test Button Visibility**
   - Verify Pull Case only shows for unassigned cases in view mode
   - Verify Move to Global only shows for admin users
   - Verify no buttons show when viewing own assigned case

4. **Test Error Handling**
   - Try pulling a case that's already assigned
   - Verify user-friendly error message
   - Try moving case to global as non-admin (via API)
   - Verify 403 Forbidden response

## 📝 Files Changed

```
src/controllers/case.controller.js  (+94 lines)
src/routes/case.routes.js           (+4 lines)
ui/src/services/caseService.js      (+17 lines)
ui/src/pages/CaseDetailPage.jsx     (+87 lines)
```

**Total:** 4 files changed, 202 insertions(+)

## 🚀 Deployment Notes

- No database migrations required
- No environment variable changes
- Backend changes are backward compatible
- Frontend changes are backward compatible
- No breaking changes to existing APIs

## 📚 Related Documentation

- [Case Workflow Implementation](./CASE_WORKFLOW_IMPLEMENTATION.md)
- [Unified Pull Logic](./PR_UNIFIED_PULL_LOGIC_README.md)
- [xID Ownership Guardrails](./PR44_XID_OWNERSHIP_GUARDRAILS.md)

## 🎉 Benefits

1. **Improved UX:** Users can pull cases without navigating back to Global Worklist
2. **Admin Efficiency:** Admins can quickly move cases back to global queue
3. **Clear Affordances:** Buttons only show when actions are available
4. **Role-Aware:** UI respects user roles and permissions
5. **Non-Destructive:** No changes to existing assignment or worklist logic
6. **Audit Trail:** All actions logged for compliance

## 🔍 Code Review Highlights

- Minimal, surgical changes to existing codebase
- Consistent with existing patterns and conventions
- Proper error handling and user feedback
- Security-first approach with multiple layers of authorization
- Comprehensive audit logging
- No breaking changes or side effects
