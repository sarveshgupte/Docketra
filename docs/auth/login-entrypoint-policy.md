# Login entry-point policy

- Firm users must sign in through workspace-scoped routes: `/:firmSlug/login`.
- Superadmin users sign in only through `/superadmin/login` (or `/superadmin` routing to app shell).
- Public homepage should route users to `/find-workspace` instead of a generic `/login`.
- xID workspace lookup is discovery-only and does not authenticate users.
- Tenant context must be established before password + OTP login flow (`/auth/login/init` and `/auth/login/verify`).
