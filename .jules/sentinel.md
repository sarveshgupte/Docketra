## 2026-07-12 - Prevent Error Details Leakage
**Vulnerability:** Found an instance in `inboundEmail.controller.js` where the error stack trace and raw error message were directly exposed to the client in a 500 Internal Server Error response.
**Learning:** Sending raw exception objects or stack traces back to clients can leak sensitive internal system details, library versions, or path structures, aiding attackers in further exploitation.
**Prevention:** Always sanitize error responses intended for external clients. Return generic error messages (e.g., 'Internal server error' or 'Failed to process request') while logging the detailed exception internally for debugging purposes.
