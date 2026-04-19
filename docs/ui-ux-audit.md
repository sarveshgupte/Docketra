# Docketra UI/UX audit and improvement pass (April 2026)

## Scope

This pass focused on high-impact reliability and trust issues in authentication and protected navigation, where users were most likely to lose context or hit dead ends.

## Key issues found

| Severity | Area | Issue | Impact |
| --- | --- | --- | --- |
| High | Auth + protected routes | Intended destination was not preserved when an unauthenticated user was redirected to login. | Users landed on generic dashboards after login instead of the page they were trying to open. |
| High | Auth security/UX | No reusable return-path sanitation utility existed for login redirects. | Risk of inconsistent redirect behavior and potential future open-redirect mistakes. |
| Medium | Firm route guard | Cross-firm access denial screen had no direct recovery actions. | Dead-end experience and additional clicks/confusion for users operating across firm URLs. |

## Fixes implemented

### 1) Preserved intended route across auth redirects

- Added `buildReturnTo` + `appendReturnTo` helpers.
- Protected route guard now appends a validated `returnTo` query param to login redirects.
- Login flows now honor `returnTo` after successful auth, falling back to role-aware default route.

### 2) Standardized secure post-login redirect logic

- Added a centralized redirect utility (`resolvePostLoginDestination`) that only allows internal `/app...` paths.
- Both superadmin and firm login screens now use the same redirect resolution behavior.

### 3) Improved cross-firm access denial recovery

- Enhanced the firm mismatch screen with explicit actions:
  - **Go to dashboard** (safe in-session route)
  - **Switch workspace** (firm login route)
- Added keyboard-visible focus styles for these critical actions.

## UX principles reinforced

1. **Never lose user intent:** preserve destination when auth interrupts navigation.
2. **Safe-by-default redirects:** only allow known internal app paths.
3. **No dead ends:** every guard/failure state should provide a clear next action.
4. **Consistency over custom logic:** shared helpers for cross-cutting route behavior.

## Remaining follow-up opportunities

1. Add automated browser-level coverage for login → returnTo flows across both superadmin and firm login.
2. Standardize all non-auth guard pages to include structured recovery actions.
3. Consolidate route-level loading/error patterns into a single shell contract for all major modules.

## Manual QA checklist

- [ ] Visit a protected URL while logged out and confirm redirect to login with preserved destination.
- [ ] Login via firm route and verify return to original protected URL.
- [ ] Login via superadmin route and verify return to original protected URL.
- [ ] Force session expiry and confirm informative sign-in messaging appears.
- [ ] Hit firm mismatch URL and verify **Go to dashboard** and **Switch workspace** both work.
- [ ] Confirm back/forward navigation around login does not create redirect loops.
- [ ] Validate keyboard focus visibility on firm mismatch action buttons.

