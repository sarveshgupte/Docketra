# Docketra Non-Negotiables

1. **Firm isolation is mandatory.**
   - All firm data paths must stay tenant-scoped.

2. **No cross-tenant data leakage.**
   - Any access path that can read/update another firm’s data is a release blocker.

3. **Auth/session reliability is mandatory.**
   - Login/logout/OTP/password reset/session state/redirects must be consistently correct.

4. **BYOS-first direction is mandatory.**
   - Firms should be actively encouraged to connect own cloud storage during onboarding/tutorial.

5. **Managed fallback must be secure.**
   - If BYOS is skipped, Docketra-managed storage must be safe, auditable, and tenant-bounded.

6. **No broken nav items.**
   - Navigation must not route users into dead pages, hard errors, or partial placeholders.

7. **No placeholder production pages.**
   - “Coming soon”/stub pages are acceptable only when explicitly non-production or gated and documented.

8. **Safe logs and redaction by default.**
   - Sensitive data must not appear in standard logs; diagnostics should be privacy-preserving.

9. **Production deploy stability over feature velocity.**
   - Regressions in auth, routing, tenant isolation, or docket lifecycle are release blockers.

10. **Critical-flow tests are required.**
   - Minimum gate includes auth/session, tenant boundaries, docket lifecycle integrity, and security hardening checks.
