import assert from 'assert';
import { loadOnboardingProgressSafely } from '../src/pages/dashboardLoadHelpers.js';

console.log('Running dashboardLoadHelpers.test.mjs...');

let progressState = 'not-set';
let warningMessage = '';

const okResult = await loadOnboardingProgressSafely({
  fetchProgress: async () => ({ success: true, data: { steps: [] } }),
  setProgress: (value) => { progressState = value; },
  firmSlug: 'acme-co',
  onWarning: (message) => { warningMessage = message; },
});

assert.strictEqual(okResult.loaded, true);
assert.strictEqual(progressState.firmSlug, 'acme-co');
assert.strictEqual(warningMessage, '');

progressState = 'not-set';
warningMessage = '';

const failedResult = await loadOnboardingProgressSafely({
  fetchProgress: async () => {
    throw new Error('timeout');
  },
  setProgress: (value) => { progressState = value; },
  firmSlug: 'acme-co',
  onWarning: (message) => { warningMessage = message; },
});

assert.strictEqual(failedResult.loaded, false);
assert.strictEqual(progressState, null);
assert.ok(warningMessage.includes('Onboarding progress unavailable'));

console.log('✅ optional onboarding progress load is non-blocking');
