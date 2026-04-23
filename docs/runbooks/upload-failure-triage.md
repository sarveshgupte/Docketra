# Upload failure triage

1. Capture `X-Correlation-ID` from browser network tab for failing request.
2. Find backend events for same correlation id:
   - `DIRECT_UPLOAD_INTENT`
   - `DIRECT_UPLOAD_FINALIZE`
   - `CLIENT_CFS_UPLOAD_INTENT`
   - `CLIENT_CFS_UPLOAD_FINALIZE`
3. Validate outcome + error code:
   - `UPLOAD_SESSION_EXPIRED`: user delay/TTL issue.
   - `UPLOAD_VERIFICATION_FAILED`: provider verify failure.
   - `UPLOAD_CHECKSUM_MISMATCH`: content integrity mismatch.
   - `UPLOAD_SESSION_BACKEND_UNAVAILABLE`: provider outage/credential drift.
4. Confirm provider mode (`firm_connected` vs `managed_fallback`) in diagnostic logs.
5. On frontend, inspect `[diag]` events for duplicate request loops and slow API preconditions.
