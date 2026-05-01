# Docketra MVP Scope (Codebase-Aligned)

## Must-have MVP features (required)
1. **Auth/session reliability**
   - Firm login, logout, session bootstrap, OTP/reset/forgot-password flows must be stable.
2. **Firm-scoped routing and isolation**
   - `/app/firm/:firmSlug/*` routing with server-side tenant invariants and auth middleware.
3. **Docket/task operations**
   - Docket lifecycle, assignment/routing, worklist/workbaskets/QC queues, activity and auditability.
4. **CRM fundamentals**
   - Lead pipeline, CRM client records, conversion-ready relationship management.
5. **CMS intake**
   - Hosted form/request-link/embed/API intake connected to CRM/docket pipeline.
6. **Role-aware admin controls**
   - Team and access controls aligned to role hierarchy.
7. **Storage path clarity**
   - BYOS encouragement + managed storage fallback if BYOS skipped.
8. **Diagnostics and security baseline**
   - Rate limits, request IDs, audit/logging contracts, production-safe error handling.

## Should-have features (beta-quality target)
- Superadmin diagnostics and onboarding insights for platform ops.
- Reports that cover throughput, queue health, and lifecycle performance.
- Clear onboarding/tutorial that explicitly guides BYOS connection.
- Performance guardrails for key dashboards and queue surfaces.

## Later features (post-MVP / roadmap)
- Fully implemented multi-provider BYOAI runtime execution (beyond config contract UI).
- Advanced reporting builder and downloadable BI packs.
- Expanded external/client portal capabilities (if introduced).
- Industry-specific packaged workflow templates beyond current generic module behavior.

## Broken/incomplete modules identified during audit
1. **AI provider runtime incomplete** (requires implementation):
   - `claude.provider` and `gemini.provider` explicitly throw “not implemented”.
   - AI settings page/controller currently positioned as configuration-contract surface rather than full runtime verification.
2. **Browser route inventory automation blocked in some environments** (operational gap):
   - Documented Playwright inventory constraints limit automated route-action coverage in constrained environments.
3. **Storage settings “coming soon” branch present for some environments** (environment-dependent incompleteness):
   - Admin controller includes “Connect Your Storage is coming soon for this environment.” response path.

## Beta-readiness truth criteria (before real-firm pilot)
1. No known tenant-isolation defect in auth, data access, and routing paths.
2. End-to-end auth QA passes for login/logout/OTP/reset and firm redirects.
3. No production nav item points to broken, placeholder, or non-functional pages.
4. CMS→CRM→Docket flow validated with at least representative firm scenarios.
5. Docket lifecycle + assignment + QC workflows validated with audit history.
6. BYOS onboarding path is clear, testable, and reversible; managed fallback is secure.
7. Security and diagnostics checks are part of release gate and pass consistently.
8. Support runbooks exist for common auth/upload/performance incidents.

## Assumptions
- Feature presence in docs/routes/tests is treated as implemented baseline; explicit runtime TODO/stub/“coming soon” markers are treated as incomplete.
- MVP scope targets production-grade pilot readiness, not maximum feature breadth.
