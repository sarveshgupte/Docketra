## 2024-03-24 - Secure Random Number Generation
**Vulnerability:** Weak pseudo-random number generator (`Math.random()`) was being used to generate upload session PINs in `src/utils/uploadToken.js`.
**Learning:** `Math.random()` is cryptographically insecure and predictable, which could allow an attacker to guess generated PINs and gain unauthorized access to upload sessions.
**Prevention:** Always use Node.js's native `crypto` module (`crypto.randomInt`, `crypto.randomBytes`) for generating secrets, PINs, tokens, or any security-sensitive values.
