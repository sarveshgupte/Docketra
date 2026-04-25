import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const isUiCwd = path.basename(process.cwd()) === 'ui';
const root = isUiCwd ? path.resolve(process.cwd(), 'src') : path.resolve(process.cwd(), 'ui/src');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const apiSource = read('services/api.js');
assert.ok(apiSource.includes('AUTH_SESSION_EXPIRED'), 'Session expiry redirects should carry AUTH_SESSION_EXPIRED code for one-time UX copy.');
assert.ok(apiSource.includes("inSuperadminNamespace"), 'Session redirect should keep SuperAdmin-safe login route handling.');

const accessDeniedSource = read('components/feedback/AccessDeniedState.jsx');
assert.ok(accessDeniedSource.includes('Access restricted'), 'Shared access denied state should expose safe title copy.');
assert.ok(accessDeniedSource.includes('Go to dashboard'), 'Shared access denied state should offer dashboard recovery action.');

const recoveryCopySource = read('constants/errorRecoveryCopy.js');
for (const code of [
  'AUTH_SESSION_EXPIRED',
  'CASE_ACCESS_DENIED',
  'CLIENT_ACCESS_RESTRICTED',
  'STORAGE_NOT_AVAILABLE',
  'STORAGE_NOT_CONNECTED',
  'UPLOAD_SESSION_EXPIRED',
  'UPLOAD_VERIFICATION_FAILED',
  'UPLOAD_CHECKSUM_MISMATCH',
  'UPLOAD_SESSION_BACKEND_UNAVAILABLE',
  'TENANT_SCOPE_TAMPERING_DETECTED',
  'CLIENT_INACTIVE',
  'ASSIGNEE_INACTIVE',
]) {
  assert.ok(recoveryCopySource.includes(code), `Recovery copy map must define ${code}.`);
}

const supportContextSource = read('components/feedback/SupportContext.jsx');
for (const forbidden of ['token', 'cookie', 'stack', 'payload', 'attachmentUrl']) {
  assert.ok(!supportContextSource.toLowerCase().includes(forbidden), `Support context component must avoid unsafe field ${forbidden}.`);
}
assert.ok(supportContextSource.includes('Request ID'), 'Support context should render request ID.');
assert.ok(supportContextSource.includes('Reason code'), 'Support context should render reason code.');

const storagePageSource = read('pages/StorageSettingsPage.jsx');
assert.ok(storagePageSource.includes('SupportContext'), 'Storage page should show support context for tenant-safe troubleshooting.');
assert.ok(recoveryCopySource.includes('Primary Admin/Admin: configure storage settings'), 'Storage recovery copy should provide role-based admin guidance.');

const caseDetailSource = read('pages/CaseDetailPage.jsx');
assert.ok(caseDetailSource.includes("getRecoveryPayload(error, 'docket_attachments_upload')"), 'Upload failures should map to recovery copy payloads.');
assert.ok(caseDetailSource.includes('supportContext'), 'Upload recovery state should carry support context for request ID visibility.');

const apiClientSource = read('api/apiClient.js');
assert.ok(apiClientSource.includes("normalizedError.requestId"), 'Normalized frontend errors should propagate request ID.');

console.log('pilotSupportRecovery.test.mjs passed');
