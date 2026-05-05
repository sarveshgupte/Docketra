# Login entry-point policy

## Routing policy
- Firm users must sign in through workspace-scoped routes: `/:firmSlug/login`.
- Superadmin users sign in through `/superadmin/login` (or `/superadmin` which routes into superadmin app flows).
- Public homepage routes to `/find-workspace` instead of generic `/login`.

## Workspace finder endpoint contract
- Endpoint: `POST /api/auth/find-workspace`
- Request body: `{ "xid": "X123456" }`
- Validation: xID format enforced (`X` + 6 digits).
- Rate limiting: `authLimiter` + `sensitiveLimiter` + `authBlockEnforcer`.
- Response shape: `{ success: true, data: { workspaces: [{ firmSlug, firmName }] } }`
- Safe metadata only: returns `firmSlug` and `firmName`.

## Non-enumeration rules
- Invalid/missing xID returns a successful generic response with an empty `workspaces` list.
- No-match and inactive-workspace outcomes return empty `workspaces` without detailed reason.
- xID lookup is **discovery only**, not authentication.
- Tenant context must be established before firm login + OTP flow (`/auth/login/init` and `/auth/login/verify`).
