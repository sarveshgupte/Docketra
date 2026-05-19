# Session timeout policy (workspace)

## Summary

Workspace sessions now expire **only after 3 hours of inactivity** (`SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000`).
Active, logged-in firm users should remain signed in during normal usage.

## What counts as activity

The workspace inactivity tracker updates `lastActiveAt` for normal app usage including:
- mouse movement/click/keyboard/touch/scroll/focus
- user-initiated route navigation events
- explicitly user-initiated API activity (not background keepalive/refetch)
- tab visibility/focus return when still authenticated

Background keepalive/profile refresh and passive refetch traffic do **not** extend idle time.

## Timeout behavior

- Show **"Session timed out"** only for true inactivity expiry (`Date.now() - lastActiveAt >= SESSION_IDLE_TIMEOUT_MS`).
- Explicit user logout still logs out immediately.
- Cross-tab logout remains synchronized.
- Cross-tab activity shares latest `lastActiveAt` where browser storage events are available.

## Auth failure behavior

Do **not** label these as inactivity timeouts:
- 403 permission failures
- network blips / transient connectivity errors
- 5xx server failures
- storage/config/refetch failures

For genuine auth expiry/revocation (401 after refresh/auth checks), use:
- **"Your session has expired. Please sign in again."**

This preserves secure logout behavior without misleading timeout messaging.
