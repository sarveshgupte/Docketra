import assert from 'assert';
import { mergeProgressWithManual, resolveCtaRoute } from '../src/components/onboarding/setupChecklistModel.js';

console.log('Running setupChecklistModel.test.mjs...');

const detectedSteps = mergeProgressWithManual({
  apiSteps: [
    { id: 'create-docket', completed: false, source: 'manual', explanation: 'No docket found yet.', cta: 'dockets', completionMode: 'detected' },
  ],
  manualSteps: { 'create-docket': true },
  firmSlug: 'acme-co',
  mode: 'admin',
});

assert.strictEqual(detectedSteps[0].completed, false, 'detected steps must not be forced complete by local manual state');
assert.strictEqual(detectedSteps[0].source, 'manual');
assert.strictEqual(detectedSteps[0].canManualComplete, false);

const manualSteps = mergeProgressWithManual({
  apiSteps: [
    { id: 'manual-confirmation', completed: false, explanation: 'Confirm this manually.', cta: 'dockets', completionMode: 'manual' },
  ],
  manualSteps: { 'manual-confirmation': true },
  firmSlug: 'acme-co',
  mode: 'admin',
});

assert.strictEqual(manualSteps[0].completed, true, 'manual steps should honor local acknowledgment');
assert.strictEqual(manualSteps[0].source, 'manual');
assert.strictEqual(manualSteps[0].canManualComplete, true);

const managerQcRoute = resolveCtaRoute('qc-queue', 'acme-co', 'manager');
assert.ok(managerQcRoute.includes('/qc-queue'));

const userWorklistRoute = resolveCtaRoute('worklist', 'acme-co', 'user');
assert.ok(userWorklistRoute.includes('/my-worklist'));

const missingRoute = resolveCtaRoute('storage-settings', null, 'user');
assert.strictEqual(missingRoute, '/superadmin');

console.log('✅ setup checklist model route + manual/detected merge rules passed');
