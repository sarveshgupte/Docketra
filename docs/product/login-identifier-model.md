# Login Identifier Model

## Summary

Docketra uses **xID (`X123456`) as the single user-facing login identifier**.

- **User-facing login ID:** `xID` (format: `X` + 6 digits, e.g. `X000001`).
- **Internal compatibility alias:** `xid` field is retained only for backward compatibility and is always synchronized to the same value as `xID`.
- **Not user-facing:** legacy `DK-XXXXX` and `DX-XXXXXXXX` formats are not accepted in login/OTP/forgot-password validation.

## Scope of this model

The `X123456` format is enforced consistently in:

- frontend input validation helpers,
- backend route schema validation,
- auth OTP identifier parsing,
- forgot-password identifier parsing,
- invite-generated visible IDs.

## Field semantics

### `xID` (canonical visible identifier)

- Immutable user login identifier.
- Used across login, forgot-password, OTP, invite communications, and user management responses.

### `xid` (compatibility alias)

- Internal alias for older code paths/tokens.
- Must mirror `xID` and never diverge.
- Not exposed as a separate user-facing credential model.

## Why this model

This removes ambiguity that previously existed between multiple patterns (`X...`, `DK-...`, `DX-...`) and prevents flow-specific mismatches where one layer accepted an ID that another layer rejected.

## Backward compatibility note

For runtime compatibility, existing references to `xid` remain supported internally, but they now map to the canonical `xID` format and should be treated as an alias only.
