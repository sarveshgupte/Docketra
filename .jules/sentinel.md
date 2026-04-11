## 2024-03-24 - Secure Random Number Generation
**Vulnerability:** Weak pseudo-random number generator (`Math.random()`) was being used to generate upload session PINs in `src/utils/uploadToken.js`.
**Learning:** `Math.random()` is cryptographically insecure and predictable, which could allow an attacker to guess generated PINs and gain unauthorized access to upload sessions.
**Prevention:** Always use Node.js's native `crypto` module (`crypto.randomInt`, `crypto.randomBytes`) for generating secrets, PINs, tokens, or any security-sensitive values.
## 2024-05-18 - Fix Path Traversal in viewAttachment and downloadAttachment
**Vulnerability:** Path Traversal (CWE-22) in `src/controllers/case.controller.js` allowed accessing arbitrary files on the filesystem by providing path manipulation characters (e.g. `../../../../etc/passwd`) within the `attachment.filePath` field.
**Learning:** `res.sendFile(path.resolve(attachment.filePath))` trusts the input path implicitly. Since `path.resolve` handles absolute paths and traversal tokens perfectly, it allowed serving files completely outside the expected `uploads` directory.
**Prevention:** Always validate that the `resolvedPath` strictly begins with the intended base upload directory (e.g., `!resolvedPath.startsWith(safeBaseDir)`) before calling `fs.access` or `res.sendFile`.
