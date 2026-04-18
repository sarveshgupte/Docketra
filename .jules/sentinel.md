## 2024-03-24 - Secure Random Number Generation
**Vulnerability:** Weak pseudo-random number generator (`Math.random()`) was being used to generate upload session PINs in `src/utils/uploadToken.js`.
**Learning:** `Math.random()` is cryptographically insecure and predictable, which could allow an attacker to guess generated PINs and gain unauthorized access to upload sessions.
**Prevention:** Always use Node.js's native `crypto` module (`crypto.randomInt`, `crypto.randomBytes`) for generating secrets, PINs, tokens, or any security-sensitive values.
## 2024-05-18 - Fix Path Traversal in viewAttachment and downloadAttachment
**Vulnerability:** Path Traversal (CWE-22) in `src/controllers/case.controller.js` allowed accessing arbitrary files on the filesystem by providing path manipulation characters (e.g. `../../../../etc/passwd`) within the `attachment.filePath` field.
**Learning:** `res.sendFile(path.resolve(attachment.filePath))` trusts the input path implicitly. Since `path.resolve` handles absolute paths and traversal tokens perfectly, it allowed serving files completely outside the expected `uploads` directory.
**Prevention:** Always validate that the `resolvedPath` strictly begins with the intended base upload directory (e.g., `!resolvedPath.startsWith(safeBaseDir)`) before calling `fs.access` or `res.sendFile`.

## 2024-05-18 - Fix Path Traversal Bypass
**Vulnerability:** Even when validating paths using `!resolvedPath.startsWith(safeBaseDir)` to protect against Path Traversal (CWE-22) like we did previously, we're still susceptible to matching unintended directories that share the same prefix (e.g., `/uploads_hacked/test.txt` would match `/uploads` prefix).
**Learning:** Checking `resolvedPath.startsWith(safeBaseDir)` is insufficient if it is not specifically matching exact directories. For instance, `/uploads` will pass if the actual path is `/uploads_hacked/test.txt`.
**Prevention:** Always append a directory separator (e.g., `path.sep`) to the base directory before using `startsWith()` to guarantee exact directory containment. For example: `safeBaseDir + path.sep`.

## 2026-04-17 - Secure Debug Route Exposure
**Vulnerability:** Debug routes were globally imported and advertised in the public-facing root `/api` discovery endpoint, even if they were gated for mounting.
**Learning:** Top-level `require` statements load modules into memory regardless of runtime conditions, and static endpoint maps in API discovery routes can leak internal infrastructure details.
**Prevention:** Use conditional lazy loading (`require` inside an environment check) to reduce production footprint and ensure discovery endpoints dynamically reflect available routes based on the environment.

## 2024-04-18 - Added Missing Rate Limiters to Production Routes
**Vulnerability:** CodeQL flagged several API routes as missing rate limiting middleware. Missing rate limiting exposes the application to denial-of-service (DoS) attacks, brute force attempts, and increased infrastructure costs due to unthrottled API abuse. Some routes (e.g., category routes) were flagged as false positives due to limits being applied within arrays through spread operators, but several routes genuinely lacked limits.
**Learning:** Newly created routes (like CRM clients, deals, leads, teams, and specialized storage/session routes) were directly defining their handlers without importing and applying the centralized limiters available in `src/middleware/rateLimiters.js`.
**Prevention:** During code review, explicitly check for the presence of rate limiting middleware (like `userReadLimiter`, `userWriteLimiter`, `attachmentLimiter`, or `publicLimiter`) on all new API endpoints, even internal or authenticated ones, to ensure defense-in-depth.
