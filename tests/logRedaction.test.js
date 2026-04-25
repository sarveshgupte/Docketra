const assert = require('assert');
const { sanitizeForLogs, sanitizeForAudit, sanitizeForPublicDiagnostics } = require('../src/utils/redaction');
const { sanitizeValue } = require('../src/utils/getFieldChanges');

const run = () => {
  const payload = {
    password: 'P@ssword123!',
    otp: '443322',
    refreshToken: 'refresh-secret',
    authorization: 'Bearer abc.def.ghi',
    resetLink: 'https://example.com/reset?token=secret-token&email=test@example.com',
    nested: {
      apiKey: 'my-api-key',
      signedUrl: 'https://s3.aws.com/file?X-Amz-Signature=abc123&X-Amz-Expires=300',
      pan: 'ABCDE1234F',
      aadhaar: '123412341234',
    },
  };

  const redacted = sanitizeForLogs(payload);
  assert.strictEqual(redacted.password, '[REDACTED]');
  assert.strictEqual(redacted.otp, '[REDACTED]');
  assert.strictEqual(redacted.refreshToken, '[REDACTED]');
  assert.strictEqual(redacted.authorization, '[REDACTED]');
  assert.strictEqual(redacted.resetLink.includes('[REDACTED]'), true);
  assert.strictEqual(redacted.nested.apiKey, '[REDACTED]');
  assert.strictEqual(redacted.nested.signedUrl.includes('[REDACTED]'), true);
  assert.strictEqual(redacted.nested.pan, '[REDACTED]');
  assert.strictEqual(redacted.nested.aadhaar, '[REDACTED]');

  const auditRedacted = sanitizeForAudit({
    requestBody: { password: 'secret' },
    cookie: 'sid=abc',
    comment: 'client discussion',
  });
  assert.strictEqual(auditRedacted.requestBody.password, '[REDACTED]');
  assert.strictEqual(auditRedacted.cookie, '[REDACTED]');
  assert.strictEqual(auditRedacted.comment, 'client discussion');

  const publicDiagnosticRedacted = sanitizeForPublicDiagnostics({
    comment: 'client discussion',
    description: 'private narrative',
    clientName: 'Acme Corp',
    accessToken: 'abc.def.ghi',
  });
  assert.strictEqual(publicDiagnosticRedacted.comment, '[REDACTED]');
  assert.strictEqual(publicDiagnosticRedacted.description, '[REDACTED]');
  assert.strictEqual(publicDiagnosticRedacted.clientName, '[REDACTED]');
  assert.strictEqual(publicDiagnosticRedacted.accessToken, '[REDACTED]');

  const diffRedacted = sanitizeValue({ accessToken: 'abc', description: 'private note' });
  assert.strictEqual(diffRedacted.accessToken, '[REDACTED]');
  assert.strictEqual(diffRedacted.description, 'private note');

  console.log('logRedaction.test.js passed');
};

try {
  run();
} catch (error) {
  console.error('logRedaction.test.js failed', error);
  process.exit(1);
}
