# Auth login + password reset QA runbook

## Scope
Manual QA for:
- SuperAdmin login
- Firm login (credential + OTP)
- Forgot password OTP flow (firm-scoped and generic entry)
- Logout + session restore behavior
- Redirect and guard correctness

## Expected flows

### 1) SuperAdmin login
1. Open `/superadmin`.
2. Submit valid SuperAdmin xID/password.
3. Verify redirect to `/app/superadmin`.
4. Refresh page; user remains authenticated until session expiry.

Expected:
- Login works without `firmSlug`.
- Profile payload returns `isSuperAdmin: true`, `firmSlug: null`, `redirectTo: /app/superadmin`.

### 2) Firm user login
1. Open `/:firmSlug/login`.
2. Submit valid firm xID/password.
3. Enter OTP.
4. Verify redirect to `/app/firm/:firmSlug/dashboard` (or role-appropriate in-firm route).

Expected:
- Firm context preserved through login init + verify.
- No bounce back to login.
- No authenticated-but-idle blank state.

### 3) Forgot password (firm URL)
1. Open `/:firmSlug/forgot-password`.
2. Run init -> OTP verify -> reset.
3. Confirm final redirect to `/:firmSlug/login`.

Expected:
- `firmSlug` preserved in all requests and response contract.
- Reset succeeds without leaking account existence.

### 4) Forgot password (generic URL)
1. Open `/forgot-password`.
2. Enter email and complete OTP + reset flow.
3. Confirm login redirect uses resolved firm login when unique, otherwise generic safe behavior.

Expected:
- No account enumeration in public responses.
- Unique account path resolves safely to firm context.

### 5) Logout behavior
- From firm workspace: logout with `preserveFirmSlug` should return to matching firm login.
- From SuperAdmin: logout should return to SuperAdmin login.
- Verify query cache cleared and websocket/session listeners cleaned up.

### 6) Session restore + expiry
- Refresh inside authenticated workspace: session should restore without loop.
- Expired session: single redirect to login without refresh recursion.

## Regression checklist
- [ ] SuperAdmin login → dashboard works.
- [ ] Firm login + OTP lands in workspace exactly once.
- [ ] Forgot-password firm URL works end-to-end.
- [ ] Generic forgot-password handles firm context safely.
- [ ] Logout preserves firm login context when intended.
- [ ] Session refresh does not loop.
- [ ] Invite accept still works.
- [ ] BYOS Google Drive connect still works.

## Known follow-ups
- Add full integration/e2e tests for OTP + redirect contracts in CI.
- Add API contract snapshots for auth payload shape consistency across login/profile/reset flows.
