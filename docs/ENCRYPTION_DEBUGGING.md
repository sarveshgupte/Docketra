# Case Description Encryption/Decryption Debugging Guide

## Quick Diagnosis

```bash
# Connect to MongoDB and check if tenant key exists
db.tenantkeys.findOne({ tenantId: "YOUR_FIRM_ID" })

# Check if case description is encrypted
db.cases.findOne({ _id: ObjectId("CASE_ID") }, { description: 1 })

# Should see something like:
# "v1:base64:base64:base64"
```

## Common Issues & Fixes

### Issue 1: Description Shows as Encrypted `v1:...`

**Symptom:** UI displays `v1:EaJBTUh8/MHm6bEo:Kuof7gRfaUcczcjARxhSg==:+`

**Cause:** Decryption failing silently or encrypted payload is corrupted/truncated.

**Solution:**
1. Check logs for `DECRYPTION_ERROR` or `DECRYPTION_FAILED`.
2. Verify `MASTER_ENCRYPTION_KEY` is set: `echo $MASTER_ENCRYPTION_KEY`.
3. Check tenant key exists: `diagnoseDescriptionDecryption(firmId, caseId)`.
4. Restart application after verifying key configuration.

### Issue 2: Cannot Create New Cases

**Symptom:** "Encryption key bootstrap failed"

**Cause:** Tenant key not created during case creation.

**Solution:**
1. Check `TenantKey` collection in MongoDB.
2. Manually bootstrap: `ensureTenantKey(firmId)`.
3. Check `MASTER_ENCRYPTION_KEY` configuration.

### Issue 3: Database Shows Truncated Encrypted Value

**Symptom:** Description ends with `:+` or `:==` (incomplete).

**Cause:** Database field has max-length constraints that truncate encrypted payload.

**Solution:**
1. Update `Case.model.js`: increase description maxlength to 5000.
2. Run migration to re-encrypt/rewrite affected descriptions.
3. Test with long descriptions (1000+ chars).

## Testing Decryption Manually

```javascript
const CaseRepository = require('./src/repositories/CaseRepository');

const report = await CaseRepository.diagnoseDescriptionDecryption(firmId, caseId);
console.log(report);
```

## Expected Diagnostic Output

```json
{
  "timestamp": "2026-03-22T10:30:00Z",
  "checks": {
    "masterKeyConfigured": true,
    "tenantKeyExists": true,
    "tenantKeyFormat": "VALID",
    "caseExists": true,
    "descriptionExists": true,
    "descriptionLooksEncrypted": true,
    "decryptionSuccessful": true,
    "decryptedPreview": "This is a sensitive legal case summary..."
  }
}
```

## Troubleshooting Flow

1. Confirm `MASTER_ENCRYPTION_KEY` is present.
2. Confirm tenant key exists and `encryptedDek` format is valid.
3. Confirm case description starts with `v1:` and has full payload sections.
4. Run repository diagnostic helper.
5. Inspect `DECRYPTION_ERROR` logs for tenantId/field/model context.

## Logs to Monitor

```text
# Success
[CaseRepository.create] Tenant key ensured
[CaseRepository.create] Case created with encrypted description

# Failure
[EncryptionService] DECRYPTION_ERROR
[CaseRepository] DECRYPTION_FAILED - FALLBACK
[CaseRepository.create] TENANT_KEY_BOOTSTRAP_FAILED
```

## Missing Tenant Key Behavior (Hotfix Policy)

- Read-time decrypt paths **must not** auto-create tenant keys when ciphertext already exists.
- If encrypted values are present but tenant key record is missing, API returns controlled operational error:
  - `code: TENANT_KEY_MISSING`
  - HTTP `503`
  - message indicating repair is required.
- Rationale: creating a new key cannot decrypt historical ciphertext and would create misleading state.

### Repair / backfill approach

Use an explicit tenant-key repair runbook/command only after confirming recoverability inputs (e.g., original wrapped DEK source, backup restore plan, or known plaintext re-entry plan). Do **not** run blind `ensureTenantKey()` against active encrypted tenants.
