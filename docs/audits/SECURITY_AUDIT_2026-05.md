# Security Audit – May 2026

## Scope
This audit reviewed authentication/session handling, tenant isolation, input/redirect safety, storage/BYOS controls, response hygiene, and operational security checks across backend routes and supporting services.

## High-confidence issues fixed in this PR

1. **Storage OAuth state cookie could remain set after invalid callback state**
   - **Risk:** stale OAuth state cookies increase callback replay/confusion risk and leave unnecessary security state on the client.
   - **Fix:** explicitly clear `storage_oauth_state` cookie on invalid state handling in Google OAuth callback.

2. **In-memory OTP JTI replay tracker had no expiry pruning**
   - **Risk:** unbounded growth can become a memory pressure vector under sustained abuse.
   - **Fix:** added opportunistic pruning of expired JTI entries before verification checks.

3. **Storage configuration and ownership summary responses cacheability**
   - **Risk:** sensitive tenant storage metadata could be cached by intermediary/browser layers.
   - **Fix:** added `Cache-Control: no-store` on storage configuration and ownership summary responses.

## Files changed
- `src/controllers/storage.controller.js`
- `tests/storageOAuthAndErrorSanitization.test.js`
- `docs/audits/SECURITY_AUDIT_2026-05.md`

## Tests added/updated
- Updated `tests/storageOAuthAndErrorSanitization.test.js` to verify:
  - invalid OAuth state clears state cookie;
  - storage config endpoint sends `Cache-Control: no-store`.

## Additional checks executed
- Syntax linting (`npm run lint`)
- Environment validation (`npm run validate:env:test`, `npm run validate:env:production`)
- Dependency audit attempted (`npm audit --omit=dev`) — blocked by npm registry advisory endpoint 403 in environment.

## Remaining risks / follow-up recommendations
- Expand route-by-route authorization conformance tests for all superadmin and tenant-scoped endpoints.
- Add explicit regression tests for forgot-password and OTP enumeration resistance across all request variants.
- Add automated secret redaction assertions for logging paths touching BYOS/BYOAI credential workflows.
- Consider persistent distributed replay protection for storage OTP verification token JTIs if multi-instance replay resistance is required.

## Intentionally not fixed in this PR
- No architectural changes to auth/session model, token formats, or storage provider abstractions were made to avoid compatibility risk.
- No major dependency upgrades were performed; only hardening code changes with low breakage risk were included.
