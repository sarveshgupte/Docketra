import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WORKBASKET_NAME_MAX_LENGTH,
  normalizeWorkbasketName,
  validateWorkbasketDraft,
  resolveWorkSettingsError,
} from '../src/utils/workbasketValidation.js';
import { shouldRefreshOnboardingProgress } from '../src/utils/onboardingProgressRefresh.js';

const uiRoot = process.cwd();
const readUi = (relativePath) => fs.readFileSync(path.resolve(uiRoot, relativePath), 'utf8');

// 1. Name normalization
assert.equal(normalizeWorkbasketName('   Compliance   Desk   '), 'Compliance Desk');
assert.equal(normalizeWorkbasketName('  '), '');

// 2. Validation rules
assert.deepEqual(validateWorkbasketDraft('   '), {
  valid: false,
  normalized: '',
  error: 'Workbasket name is required and must be valid.',
});

const tooLongName = 'A'.repeat(WORKBASKET_NAME_MAX_LENGTH + 1);
assert.equal(validateWorkbasketDraft(tooLongName).valid, false, 'Names over max length must be rejected');

for (const reserved of ['Tax - QC', 'Tax — QC', 'Tax–QC', 'Audit  -  qc']) {
  const res = validateWorkbasketDraft(reserved);
  assert.equal(res.valid, false, `Reserved QC suffix should be rejected: ${reserved}`);
  assert.match(res.error, /- QC/);
}

const existing = [
  { _id: 'wb-1', name: 'Corporate Law & ROC', type: 'PRIMARY' },
  { _id: 'wb-1-qc', name: 'Corporate Law & ROC — QC', type: 'QC' },
  { _id: 'wb-2', name: 'Indirect Tax', type: 'PRIMARY', isActive: false },
];

assert.equal(validateWorkbasketDraft('  corporate   law & roc ', existing).valid, false, 'Case-insensitive whitespace duplicate must be caught');
assert.equal(validateWorkbasketDraft('INDIRECT TAX', existing).valid, false, 'Duplicate against inactive workbasket must be caught');
assert.equal(validateWorkbasketDraft('Corporate Law & ROC', existing, 'wb-1').valid, true, 'Same-id rename check should allow keeping current name');
assert.deepEqual(validateWorkbasketDraft('  GST  Litigation  ', existing), {
  valid: true,
  normalized: 'GST Litigation',
  error: '',
});

// 3. Error resolution normalization
assert.equal(
  resolveWorkSettingsError({ status: 409, data: { message: 'Already exists' } }, { 409: 'Fallback dup' }, 'Fallback'),
  'Already exists',
);
assert.equal(
  resolveWorkSettingsError({ status: 403 }, { 403: 'No permission' }, 'Fallback'),
  'No permission',
);
assert.equal(
  resolveWorkSettingsError(new Error('Network down'), { 409: 'Dup' }, 'Fallback'),
  'Network down',
);

// 4. WorkSettingsPage & admin.api.js wiring contracts
const workSettingsSource = readUi('src/pages/WorkSettingsPage.jsx');
assert.ok(workSettingsSource.includes('validateWorkbasketDraft'), 'WorkSettingsPage should validate drafts via shared helper');
assert.ok(workSettingsSource.includes('resolveWorkSettingsError'), 'WorkSettingsPage should map action errors via shared helper');
assert.ok(workSettingsSource.includes('adminApi.createWorkbasket(nextName)'), 'WorkSettingsPage should invoke adminApi.createWorkbasket');

const adminApiSource = readUi('src/api/admin.api.js');
assert.ok(adminApiSource.includes('/admin/workbaskets'), 'adminApi should post to /admin/workbaskets');
assert.equal(shouldRefreshOnboardingProgress({ method: 'post', url: '/admin/workbaskets' }), true, 'Creating a workbasket must refresh onboarding progress');

console.log('workbasketCreationUi.test.mjs passed');
