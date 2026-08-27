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

## 2026-06-21 - Prevent NoSQL Injection / ReDoS in Regex Query
**Vulnerability:** Unescaped user input (`name`) was being passed directly into a regular expression constructor in a MongoDB `findOne` query in `src/controllers/documentItem.controller.js`.
**Learning:** Passing user input directly to a regex constructor without escaping can lead to ReDoS and potential NoSQL injection attacks by allowing attackers to manipulate the regular expression behavior.
**Prevention:** Always escape user-provided values used within dynamic regular expressions (e.g. using `escapeRegExp` from `src/utils/regexp.utils.js`).
## 2024-05-28 - ReDoS Vulnerabilities in Regex Queries
**Vulnerability:** Several dynamically constructed `new RegExp(...)` statements in Mongoose queries were found in the `src/controllers/documentItem.controller.js` and `src/controllers/knowledgeItem.controller.js` controllers, using unescaped user-supplied inputs to filter documents.
**Learning:** Instantiating `new RegExp()` using unescaped inputs provides an attack vector for Regular Expression Denial of Service (ReDoS) by allowing maliciously crafted input strings to severely degrade performance or crash the service. There was a lack of consistent, centralized escaping for regex generation across the codebase.
**Prevention:** Always use the centralized `escapeRegExp` utility from `src/utils/regexp.utils.js` to escape dynamic user inputs before passing them to `new RegExp()` or MongoDB `$regex` statements, ensuring inputs are treated strictly as literals rather than regular expression syntax.
## 2024-05-22 - Mass Assignment and IDOR Vulnerability in Audit Fields
**Vulnerability:** The application was trusting client-provided audit fields (`createdBy` and `updatedBy`) from `req.body` directly in the `user.controller.js` file, which allows mass assignment and IDOR vulnerabilities, enabling an attacker to manipulate audit records.
**Learning:** This exposes the application to situations where attackers can modify user records and mask their actions or impersonate system/other users' operations.
**Prevention:** To prevent Mass Assignment and IDOR vulnerabilities, never trust client-provided audit fields (e.g., `createdBy`, `updatedBy`, `performedBy`) from `req.body`. Always derive these values securely from server-side authenticated context like `req.user` (e.g., `req.user?._id || null`).

## 2026-06-17 - Prevent ReDoS by Escaping Dynamic Regex Inputs in Controllers
**Vulnerability:** Regular Expression Denial of Service (ReDoS) and NoSQL Regex Injection via unescaped variables passed to `new RegExp()` constructors in `documentItem.controller.js` and `knowledgeItem.controller.js`.
**Learning:** Directly passing dynamic, user-controlled strings to the `RegExp` constructor allows attackers to construct potentially catastrophic patterns that drastically degrade performance or bypass exact match logic.
**Prevention:** Always wrap dynamically generated string segments in the centralized `escapeRegExp` utility (`src/utils/regexp.utils.js`) before injecting them into a `RegExp` constructor.

## 2024-10-27 - Hardcoded Fallback Secret in HMAC Generation
**Vulnerability:** A hardcoded fallback secret (`docketra-system-default-secret-key-12345`) was used in `generateDocketEmailSignature` when the `SYSTEM_HASH_SECRET` environment variable was missing.
**Learning:** Hardcoded cryptographic secrets are easily discovered in source code, allowing attackers to forge signatures and bypass security controls. In this case, an attacker could forge email signatures and manipulate workflows if the system was improperly configured.
**Prevention:** Never use hardcoded strings as fallbacks for cryptographic secrets. Always fail securely (e.g., throw an error during initialization or execution) if a required secret is missing from the environment configuration.
## 2025-02-14 - Prevent Mass Assignment in Compliance Template Controller
**Vulnerability:** The Compliance Template Controller directly spread `req.body` into MongoDB create and update payloads without filtering out protected fields.
**Learning:** Directly spreading `req.body` allows attackers to overwrite critical fields like `_id`, `firmId`, `createdByXID`, and `updatedByXID`, leading to IDOR and privilege escalation.
**Prevention:** Always clone `req.body` and explicitly `delete` protected root-level fields before spreading it into a database payload.

## 2026-08-16 - Mass Assignment and IDOR Vulnerability in Case Lock Middleware
**Vulnerability:** The `checkCaseLock` middleware trusted client-provided fields (`req.body.performedBy`, `req.body.createdBy`, `req.body.clonedBy`) to determine the user identity (email) for lock operations.
**Learning:** Trusting client-provided fields allows an attacker to bypass lock checks or perform operations under the guise of another user, leading to IDOR.
**Prevention:** Always derive user identity securely from the authenticated server-side context (e.g., `req.user?.email`).
## 2026-08-15 - Prevent Information Exposure via Error Stack Traces
**Vulnerability:** Leaking `error.stack` details directly in `sendError` API responses within `src/controllers/inboundEmail.controller.js`.
**Learning:** Including raw stack traces in client HTTP responses is an Information Exposure vulnerability (CWE-200), revealing internal filesystem paths, dependencies, and application topology to unauthenticated clients.
**Prevention:** Only log stack traces server-side and ensure HTTP responses strictly return generic, safe operational error codes/messages without internal internals.

## 2024-10-28 - IDOR Vulnerability in Case Workflow Controller
**Vulnerability:** The Case Workflow Controller trusted client-provided `userEmail` from `req.body` directly when performing state transitions (e.g., `submitCase`, `closeCase`), which allows IDOR vulnerabilities by enabling an attacker to impersonate another user.
**Learning:** This exposes the application to situations where attackers can manipulate case states under the guise of another user.
**Prevention:** To prevent IDOR vulnerabilities, never trust client-provided identity fields (e.g., `userEmail`) from `req.body`. Always derive these values securely from server-side authenticated context like `req.user` (e.g., `req.user?.email`).
## 2024-05-24 - Information Disclosure in API Responses
**Vulnerability:** API endpoints in `docketException.controller.js` were returning raw `error.message` strings directly to clients in 500 error responses, risking exposure of sensitive internal state.
**Learning:** It is a pattern in this codebase to pass `error.message` into JSON responses instead of safely logging it server-side.
**Prevention:** Always log the full error server-side using the project's logger utility (`log.error('EVENT_NAME', { message: error.message, stack: error.stack })`) and return a generic, safe error message to the client.
