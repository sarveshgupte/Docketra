# Docketra Security Audit Fix Prompts - 2026-06-06

Use these prompts one by one. Each prompt is scoped to a specific audit finding from the local security audit of `C:\Users\Sarvesh\Docketra-main`.

## Master Context Prompt

```text
You are working in the Docketra repo at C:\Users\Sarvesh\Docketra-main.

Security posture to preserve:
- Keep Docketra's cookie-first auth model. Access and refresh tokens should be set only through HTTP-only cookies unless a route is explicitly designed as a non-browser API.
- Preserve tenant isolation: firm routes must keep authenticate + firmContext + requireTenant + tenantThrottle + invariantGuard where applicable.
- Preserve SuperAdmin boundaries: SuperAdmin must not access firm-scoped routes unless there is an explicit platform route for that behavior.
- Preserve request validation through src/schemas/*.routes.schema.js and applyRouteValidation.
- On this Windows PowerShell setup, npm scripts that use POSIX inline env assignment can fail before tests run. When that happens, run the underlying node tests directly.
- Do not refactor unrelated UI or product flows.
- Do not expose secret values in logs, responses, screenshots, or test output.

Before editing, inspect the current files and tests. After editing, run the narrow tests listed in the prompt and report any skipped tests with the exact reason.
```

## Prompt 1 - Remove Token Exposure From Auth Responses And Logs

```text
Fix the auth token exposure findings from the security audit.

Files to inspect first:
- src/controllers/auth.controller.js
- src/controllers/user.controller.js
- src/controllers/publicSignup.controller.js
- src/services/authLogin.service.js
- src/services/authSession.service.js
- tests/authLoginCookieFlow.test.js
- tests/publicSignupTransaction.test.js
- tests/authOnboardingParity.test.js
- tests/mfaLoginFlow.test.js

Confirmed issues:
- src/controllers/auth.controller.js logs a full password reset URL containing a raw reset token around the forcePasswordReset branch.
- src/controllers/auth.controller.js Google OAuth exchange sets HTTP-only cookies but still returns raw accessToken/refreshToken in the JSON response.
- src/controllers/user.controller.js completeProfile returns data.accessToken even though the UI ignores it and calls fetchProfile.
- src/controllers/publicSignup.controller.js legacy public verifyOtp returns token: result.token.
- Some old tests still expect raw body tokens, so update tests to enforce cookie-only/no-token response behavior instead of preserving the old contract.

Required behavior:
- Never log raw reset/setup/login/access/refresh tokens or full URLs containing token query params.
- Google OAuth exchange should set cookies and return user/session metadata only, with no accessToken or refreshToken keys anywhere in the response body.
- Complete profile should not return data.accessToken. If it needs to refresh the session after firm creation, set HTTP-only cookies server-side or rely on the existing authenticated cookie and profile refresh flow.
- Legacy public signup verifyOtp should not return a raw JWT token. Prefer redirect metadata and non-sensitive signup result data only.
- Keep existing successful login cookie behavior intact.
- Add or update regression tests that assert response bodies do not contain accessToken, refreshToken, token, or raw reset URLs for the touched paths.

Suggested tests:
- node tests/authLoginCookieFlow.test.js
- node tests/authOnboardingParity.test.js
- node tests/publicSignupTransaction.test.js
- node tests/mfaLoginFlow.test.js
- node tests/logRedaction.test.js
- node tests/loggingDiagnosticsHardening.test.js
- node tests/user.serialization.privacy.test.js
```

## Prompt 2 - Retire Or Harden Legacy Public Signup Routes

```text
Fix the legacy public signup anti-abuse gap.

Files to inspect first:
- src/routes/publicSignup.routes.js
- src/controllers/publicSignup.controller.js
- src/routes/auth.routes.js
- src/services/authSignup.service.js
- src/services/signup.service.js
- src/middleware/turnstile.middleware.js
- src/middleware/rateLimiters.js
- src/app/routes/mountPlatformRoutes.js
- ui/src/api/auth.api.js
- tests/publicSignupTransaction.test.js
- tests/turnstileSignupProtection.test.js
- tests/signupAntiAbuseProtection.test.js
- tests/rateLimitDevelopmentConfig.test.js

Confirmed issue:
- The canonical /auth/signup/* path uses signupLimiter and Turnstile for signup init.
- The legacy /api/public/initiate-signup and /api/public/verify-otp routes remain mounted separately and do not have the same controls.

Required behavior:
- Prefer retiring the legacy public signup routes if the UI no longer uses them.
- If backward compatibility is required, add equivalent controls:
  - authBlockEnforcer if appropriate for public auth abuse controls
  - signupLimiter on initiate/verify/resend
  - otpVerifyLimiter and otpResendLimiter on OTP endpoints
  - requireTurnstileForSignup on initiation when Turnstile is enabled
- Legacy route responses must not include raw tokens.
- Update or add route contract tests so future changes cannot reintroduce a weaker public signup path.
- Keep /auth/signup/init, /auth/signup/verify, and /auth/signup/resend working for the current UI.

Suggested tests:
- node tests/turnstileSignupProtection.test.js
- node tests/signupAntiAbuseProtection.test.js
- node tests/publicSignupTransaction.test.js
- node tests/rateLimitDevelopmentConfig.test.js
- npm --prefix ui run test:auth-reliability-routes
```

## Prompt 3 - Apply Hardened Upload Controls To Docket Attachments

```text
Fix docket attachment upload validation so it uses the same hardened upload pipeline as public uploads.

Files to inspect first:
- src/routes/docketFileStorage.routes.js
- src/controllers/docketFileStorage.controller.js
- src/services/docketFileStorage.service.js
- src/schemas/docketFileStorage.routes.schema.js
- src/middleware/uploadProtection.middleware.js
- src/routes/public.routes.js
- src/controllers/uploadSession.controller.js
- tests/docketFileStorage.service.test.js
- tests/directUpload.service.test.js
- tests/*upload*

Confirmed issue:
- src/routes/docketFileStorage.routes.js uses raw multer.memoryStorage with a 25MB limit.
- That path bypasses MIME allowlist, extension matching, byte-signature sniffing, and ClamAV strict-mode behavior implemented in uploadProtection.middleware.js.

Required behavior:
- Replace raw Multer usage with createSecureUpload({ memory: true }) and enforceUploadSecurity.
- Preserve requireStorageConnected, authorizeFirmPermission('CASE_UPDATE'), and requireCaseAccess ordering.
- Align max upload size with config.security.upload.maxSizeMB unless there is a documented exception.
- Reject MIME/extension mismatches and invalid signatures before provider upload.
- In production or UPLOAD_SCAN_STRICT=true, fail closed when malware scanning is unavailable.
- Add route/controller-level tests for rejecting .exe, MIME spoofing, oversized upload, and scanner-unavailable strict mode.
- Keep provider upload compatibility tests passing.

Suggested tests:
- node tests/docketFileStorage.service.test.js
- node tests/directUpload.service.test.js
- node tests/storageOAuthAndErrorSanitization.test.js
- node tests/byosRegressionSecurityAudit.test.js
- Add a focused docketFileStorage upload security test if one does not exist.
```

## Prompt 4 - Resolve Backend And Frontend Dependency Advisories

```text
Fix npm audit findings without broad framework churn.

Files to inspect first:
- package.json
- package-lock.json
- ui/package.json
- ui/package-lock.json
- any code importing xlsx, exceljs, axios, react-router-dom, vite, nodemailer, bullmq, wrangler

Audit summary from 2026-06-06:
- Backend: 18 advisories, 3 high, 15 moderate.
- Backend high direct/no-fix: xlsx.
- Backend notable direct advisories: xlsx, nodemailer, bullmq, exceljs, express-rate-limit, wrangler.
- Frontend: 7 advisories, 1 high, 6 moderate.
- Frontend high direct: axios.
- Frontend notable direct advisories: axios, react-router-dom, vite.

Required behavior:
- Remove xlsx if it is unused. If spreadsheet parsing is needed, replace it with a maintained alternative or isolate parsing behind strict file validation and document residual risk.
- Upgrade axios to a fixed version and ensure auth/cookie behavior in ui/src/services/api.js still works.
- Upgrade react-router-dom within the current major if possible; only use a major upgrade if required and tests/build remain stable.
- Handle Vite/esbuild advisories with the smallest safe upgrade that the current frontend supports.
- Update package-lock files intentionally.
- Do not introduce new dependency families unless needed.
- Document any remaining no-fix advisories and why they are acceptable or queued.

Suggested checks:
- npm audit --json
- npm --prefix ui audit --json
- npm run ci:backend:routes
- npm --prefix ui run build
- npm --prefix ui run test:ci
- Run backend node tests directly if POSIX npm scripts fail on Windows.
```

## Prompt 5 - Migrate Storage Token Encryption To Authenticated Encryption

```text
Replace unauthenticated AES-CBC storage token encryption with authenticated encryption.

Files to inspect first:
- src/services/storage/services/TokenEncryption.service.js
- src/utils/encryption.js
- src/services/storage/resolveFirmStorageState.js
- src/controllers/storage.controller.js
- src/services/googleDrive.service.js
- src/services/storage/syncTenantStorageConfig.js
- tests/storageController.test.js
- tests/storageStateNormalization.test.js
- tests/byosRegressionSecurityAudit.test.js

Confirmed issue:
- TokenEncryption.service.js uses aes-256-cbc with IV:ciphertext but no auth tag or HMAC.
- src/utils/encryption.js already uses AES-256-GCM with an auth tag and an enc:: prefix.

Required behavior:
- Implement versioned authenticated encryption for storage credentials, preferably AES-256-GCM.
- Preserve backward-compatible decryption for existing CBC blobs during migration.
- New writes must use the new authenticated format.
- Tampered ciphertext must fail closed and must not be silently accepted.
- Do not log raw credential values.
- Add tests for:
  - new encrypt/decrypt roundtrip
  - legacy CBC decrypt compatibility
  - tamper detection
  - storage config read/write still omits refreshToken/accessToken/privateKey/clientSecret from responses

Suggested tests:
- node tests/storageController.test.js
- node tests/storageStateNormalization.test.js
- node tests/byosRegressionSecurityAudit.test.js
- node tests/storageOAuthAndErrorSanitization.test.js
- node tests/securityArchitecture.test.js with explicit test env keys if needed
```

## Prompt 6 - Make Security Gates Cross-Platform And Stop Masking Env Drift

```text
Fix local and CI security gate reliability.

Files to inspect first:
- package.json
- scripts/run-secret-scan.sh
- scripts/validateEnvProduction.js
- scripts/validateEnvTest.js
- tests/backendRuntimeEntrypoints.smoke.test.js
- src/config/env.js
- .github/workflows/ci.yml
- .github/workflows/secret-scanning.yml
- docs/security/SECRET_SCANNING.md
- docs/security/production-env.md

Confirmed issues:
- npm run ci:backend:security fails on Windows because scripts use POSIX inline env assignment and sh -c.
- npm run security:secrets fails on Windows because bash is not available.
- scripts/validateEnvProduction.js overwrites production env values, including AUTH_DEBUG_DIAGNOSTICS=false, so it can mask real env drift.
- Runtime smoke caught local AUTH_DEBUG_DIAGNOSTICS=true in .env/env.yaml while validateEnvProduction passed.

Required behavior:
- Replace POSIX inline env scripts with cross-platform Node wrappers or a package like cross-env.
- Make secret scanning runnable on Windows, Linux CI, and developer machines. Prefer a Node wrapper that invokes local gitleaks, Docker in CI, or a platform-specific downloaded binary.
- Split production env validation into:
  - a fixture validation test using known safe placeholders
  - a real-current-env validation that does not override existing values
- Ensure production validation fails if AUTH_DEBUG_DIAGNOSTICS=true or UPLOAD_SCAN_STRICT is not true.
- Keep CI behavior on Ubuntu intact.
- Update docs with the exact local commands for Windows PowerShell.

Suggested checks:
- npm run validate:env:production
- npm run ci:backend:security
- npm run security:secrets
- node tests/backendRuntimeEntrypoints.smoke.test.js
- node tests/productionConfigValidation.test.js
- node tests/secretScanning.contract.test.js
```

## Prompt 7 - Remove Tracked Scratch Files And Scanner Noise

```text
Clean tracked scratch/debug files from the production repository.

Files to inspect first:
- rewrite_auth.js
- test_auth.js
- patch.diff
- load-tests/core-endpoints.js
- scripts/resetAdmin.js.txt
- .gitignore
- .dockerignore
- docs/testing or docs/runbooks for any references

Confirmed issue:
- rewrite_auth.js is tracked and duplicates old auth code including reset-token logging.
- test_auth.js is tracked and contains a named local user lookup and concrete firm IDs.
- patch.diff is tracked and contains scanner-noisy placeholder env assignments.
- These files are not part of the Docker COPY path, but they create repo hygiene, scanner noise, and stale-security-pattern risk.

Required behavior:
- Remove tracked scratch/debug artifacts that are not needed.
- If any script is still useful, move it into a documented scripts/dev-only or docs/runbooks location, sanitize all personal values, and make it clearly non-production.
- Update .gitignore to prevent future scratch auth/debug files from being committed.
- Ensure secret scanning still allows intentional examples but catches real secrets.

Suggested checks:
- git status --short
- npm run security:secrets
- node tests/secretScanning.contract.test.js
- rg -n "PASSWORD RESET LINK|sarveshgupte|mongodb://127.0.0.1:27017/docketra|jwt-token|ChangeMe@123" rewrite_auth.js test_auth.js patch.diff docs scripts tests
```

## Prompt 8 - Run The Docker Container As Non-Root

```text
Harden the production Docker image so the app does not run as root.

Files to inspect first:
- Dockerfile
- .dockerignore
- package.json
- src/app/createApp.js
- src/middleware/uploadProtection.middleware.js
- docs/deployment/cloud-run-api.md

Confirmed issue:
- Dockerfile uses node:20-slim but never switches to a non-root user.

Required behavior:
- Use the existing node user from the official image, or create a dedicated non-root user.
- Ensure /app ownership allows node to read app files and, if needed, create uploads/private.
- Do not copy .env/env.yaml/secrets into the image.
- Keep production dependency install working.
- Keep Cloud Run compatibility on PORT=8080.

Suggested checks:
- docker build -t docketra-api-security .
- docker run --rm -p 8080:8080 --env-file <safe-test-env-file-if-needed> docketra-api-security
- If Docker is unavailable locally, at least document the command and run node tests/backendRuntimeEntrypoints.smoke.test.js.
```

## Prompt 9 - Remove Gemini API Key From Query Strings

```text
Harden Gemini provider credential transport.

Files to inspect first:
- src/services/ai/providers/gemini.provider.js
- src/services/ai/providers/openai.provider.js
- src/services/ai/ai.service.js
- src/controllers/superadminAiAssistant.controller.js
- tests/*ai*
- docs/BYOAI_SETUP.md

Confirmed issue:
- gemini.provider.js builds a URL with ?key=${apiKey}. Query-string credentials are more likely to leak through upstream/proxy/request telemetry.

Required behavior:
- Use the safest supported Gemini API authentication style available in the current SDK/API surface. Prefer an auth header if supported by the endpoint/library in use.
- If the current endpoint requires a query key, centralize URL redaction and guarantee no full request URL is logged or attached to error.details.
- Redact provider error bodies before storing them on errors or returning/logging them.
- Keep provider behavior compatible with existing AI service contracts.
- Add tests that provider errors do not include the API key, request URL with key, prompt text, or raw upstream response containing credentials.

Suggested checks:
- node tests/superadminDiagnostics.service.test.js
- node tests/securityMonitoringPhase4.test.js
- Add or update focused ai provider redaction tests.
```

## Prompt 10 - Clean Local And Deployment Env Debug Settings

```text
Fix local/deployment environment drift for auth debug diagnostics.

Files to inspect first:
- .env
- env.yaml
- .env.example
- docs/security/production-env.md
- src/config/env.js
- src/routes/auth.routes.js
- src/controllers/auth.controller.js
- scripts/validateEnvProduction.js
- tests/backendRuntimeEntrypoints.smoke.test.js
- tests/productionConfigValidation.test.js

Confirmed issue:
- Local .env and env.yaml have AUTH_DEBUG_DIAGNOSTICS enabled.
- src/config/env.js correctly rejects AUTH_DEBUG_DIAGNOSTICS=true in production.
- validateEnvProduction.js overrides AUTH_DEBUG_DIAGNOSTICS=false, so it does not validate the real local/deploy env value.

Required behavior:
- Set AUTH_DEBUG_DIAGNOSTICS=false in local production-like env files and deployment env files.
- Ensure env.yaml is not used with debug diagnostics enabled for Cloud Run/Render production deploys.
- Keep /auth/debug-cookie-state returning 404 in production and when diagnostics are disabled.
- Add a real-env validation command that fails when current env has production-forbidden values.
- Do not commit real secrets.

Suggested checks:
- npm run validate:env:production after fixing script semantics
- node tests/backendRuntimeEntrypoints.smoke.test.js
- node tests/authDebugDiagnostics.test.js
- node tests/productionConfigValidation.test.js
```

## Prompt 11 - Optional Hardening: Add Turnstile To Public Form Submission

```text
Consider adding Turnstile to public form submission if public forms are exposed to the internet.

Files to inspect first:
- src/routes/public.routes.js
- src/controllers/form.controller.js
- src/middleware/turnstile.middleware.js
- src/middleware/rateLimiters.js
- ui/src/pages/PublicFormPage.jsx
- docs/security/signup-anti-abuse-controls.md

Audit context:
- Public forms already have rate limiting, honeypot, field validation, and embed-origin checks.
- Public file uploads and signup/forgot-password/login verification already have Turnstile middleware.
- Non-embed public form submission currently does not require Turnstile.

Required behavior if you implement:
- Add a form-specific Turnstile middleware and audit events.
- Preserve existing embed-origin checks.
- Keep the form usable when Turnstile is disabled by environment.
- Update UI to submit the Turnstile token.
- Add tests for missing, failed, and successful Turnstile verification.

Suggested tests:
- Add form Turnstile middleware tests parallel to tests/turnstileSignupProtection.test.js.
- node tests/routeValidationContract.test.js
- npm --prefix ui run test:forms
```
