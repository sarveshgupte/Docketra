# User Data Serialization Security Contract

## Purpose
This contract guarantees that sensitive authentication and login telemetry fields are never exposed in API JSON responses by default.

## Canonical serializer
- `src/utils/userSerialization.js` defines `sanitizeUserForOutput(userLike)`.
- `src/models/User.model.js` uses this sanitizer in both `toJSON` and `toObject` transforms.
- `User` model exposes `user.toSafeObject()` as a centralized safe serializer.

## Redacted fields (default deny-list)
The serializer removes the following fields from outbound payloads:
- `passwordHash`
- `authProviders.local.passwordHash`
- `passwordSetupTokenHash`
- `inviteTokenHash`
- `setupTokenHash`
- `passwordResetTokenHash`
- `forgotPasswordResetTokenHash`
- `loginOtpHash`
- `forgotPasswordOtpHash`
- `twoFactorSecret`
- `passwordHistory`
- `lockUntil`
- `failedLoginAttempts`
- `signupIP`
- `signupUserAgent`
- `lastLoginIp`
- `lastLoginCountry`
- `deletedAuthSnapshot`

## Admin-only exception model
If privileged/security UI needs specific sensitive metadata, it must map explicit fields in dedicated admin responses instead of returning raw user documents.

## Regression coverage
`tests/user.serialization.privacy.test.js` verifies:
- `toSafeObject()` strips all sensitive fields.
- `toJSON()` strips all sensitive fields.
- `JSON.stringify(userDoc)` does not leak sensitive fields.
- List/detail/self/superadmin-style payloads built from safe serialization do not expose restricted fields.


## CI/security suites
`tests/user.serialization.privacy.test.js` is executed by both `npm run test:security` and `npm run test:security:pure`, so privacy serialization regressions are covered in normal CI/security runs (not only manual execution).
