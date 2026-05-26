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
## 2025-02-15 - Prevent HTTP Header Injection in Downloads
**Vulnerability:** HTTP Response Splitting / Header Injection. The `attachment.fileName` was interpolated directly into the `Content-Disposition` header in `src/controllers/client.controller.js` and `src/controllers/case.controller.js`.
**Learning:** If an attacker can control the filename of an uploaded file, they could potentially inject CRLF characters or quotes to manipulate the HTTP response headers or perform directory traversal during download.
**Prevention:** Always use `sanitizeFilename` from `src/utils/fileUtils.js` to strip potentially dangerous characters from filenames before setting them in the `Content-Disposition` header.

## 2026-05-21 - Prevent ReDoS by Escaping Regex Variables
**Vulnerability:** User-derived inputs (`originalSlug`) were passed unescaped into dynamic `new RegExp(...)` constructors in MongoDB queries.
**Learning:** This pattern can lead to Regular Expression Denial of Service (ReDoS) or NoSQL injection attacks if the input contains regex special characters.
**Prevention:** Always escape user-derived inputs or dynamically generated strings before using them in regular expressions. A centralized `escapeRegExp` utility was created in `src/utils/regexp.utils.js` for this purpose.

## 2026-05-08 - Secure Random Jitter
**Vulnerability:** Weak PRNG (`Math.random()`) was used for socket reconnection jitter.
**Learning:** Even when random numbers aren't strictly used for cryptographic keys, using insecure PRNGs can flag SAST tools and sets a bad precedent. It's better to default to cryptographically secure RNGs.
**Prevention:** Use `crypto.randomInt()` instead of `Math.random()` universally.

## 2024-05-09 - Replaced Insecure Math.random() in Frontend
**Vulnerability:** Found multiple usages of `Math.random()` in the frontend for generating ID strings like correlation IDs, idempotency keys, and submission keys.
**Learning:** Even for non-cryptographic usages (like DOM IDs or tracking IDs), using `Math.random()` triggers SAST (Static Application Security Testing) warnings and provides weak randomness that could theoretically lead to ID collisions or predictability, compromising tracking workflows.
**Prevention:** Use the centralized secure randomness utilities (e.g., `generateSecureRandomString`, `generateUUID` from `ui/src/utils/crypto.js`) that leverage the Web Crypto API (`window.crypto.getRandomValues`) to ensure robust, cryptographically secure IDs on the client side.

## 2026-05-21 - Prevent Information Disclosure in API Responses
**Vulnerability:** Raw error messages (`error.message`) were being directly exposed to clients in API error responses (e.g., in `src/controllers/user.controller.js`).
**Learning:** Exposing raw internal error details to the client can leak sensitive system information, configuration details, or underlying infrastructure state, which can be leveraged by attackers.
**Prevention:** Always log the full error details server-side using the internal logger (`log.error`) and return generic, safe error messages to the client (e.g., "Unable to load profile").
## 2026-05-26 - Prevent Information Disclosure in Notification Controller
**Vulnerability:** Raw error messages (`error.message`) were being directly exposed to clients in API error responses in `src/controllers/notifications.controller.js`.
**Learning:** Exposing raw internal error details to the client can leak sensitive system information, configuration details, or underlying infrastructure state, which can be leveraged by attackers. This is a recurring pattern that needs to be systematically addressed.
**Prevention:** Always log the full error details server-side using the internal logger (`log.error`) and return generic, safe error messages to the client (e.g., "Failed to load notifications").
