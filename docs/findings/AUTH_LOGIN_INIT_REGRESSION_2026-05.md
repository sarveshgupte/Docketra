# AUTH login init regression (May 2026)

## Symptom
- Production firm login init at `POST /api/auth/login/init` intermittently failed with:
  - `AUTH_LOGIN_SERVICE_FAILED`
  - `error: "next is not a function"`
  - `statusCode: 500`

## Root cause
- `User` model query middleware around hierarchy update validation used callback-style assumptions in a path where modern Mongoose query middleware executes without the callback contract.
- During auth login-init failure accounting updates, query middleware invocation could throw `next is not a function`, converting a controlled invalid-credential branch into a 500.

## Fix
- Keep hierarchy validation middleware in non-callback query middleware form for both:
  - `pre('findOneAndUpdate')`
  - `pre('updateMany')`
- Middleware now performs synchronous payload validation via `assertHierarchyUpdatePayload(this.getUpdate() || {})` and throws validation errors directly.
- Auth login service error logging includes stack traces for server diagnosis without logging secrets, OTP values, or passwords.

## Tests run
- `node tests/authLoginInitRegression.test.js`
- `node tests/authLoginCookieFlow.test.js`
- `npm run test:auth-pilot-smoke`
- `npm run test:security:pure`
- `npm run lint`

## Deploy verification checklist
- [ ] Deploy backend to staging with this patch only.
- [ ] Verify `POST /api/auth/login/init` for a valid firm + valid password returns 200 and `otpRequired: true`.
- [ ] Verify invalid credentials do **not** return 500 and remain controlled (401/429 as applicable).
- [ ] Confirm no logs contain OTP codes, raw passwords, or password hashes.
- [ ] Confirm no `next is not a function` occurrences for auth login init in runtime logs after deploy.
