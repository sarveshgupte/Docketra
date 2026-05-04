const assert = require('assert');
const { CHECKLIST_KEYS, clampScore, deriveOverallStatus } = require('../src/services/superadminPilotReadiness.helpers');

function testChecklistKeys() {
  console.log('Running testChecklistKeys...');
  assert(Array.isArray(CHECKLIST_KEYS), 'CHECKLIST_KEYS should be an array');
  assert(CHECKLIST_KEYS.length > 0, 'CHECKLIST_KEYS should not be empty');
  assert(CHECKLIST_KEYS.includes('superadmin_auth_route_protection'), 'Should include superadmin_auth_route_protection');
  console.log('testChecklistKeys passed.');
}

function testClampScore() {
  console.log('Running testClampScore...');
  // Happy path
  assert.strictEqual(clampScore(50), 50);
  assert.strictEqual(clampScore(0), 0);
  assert.strictEqual(clampScore(100), 100);
  assert.strictEqual(clampScore('75'), 75);

  // Edge cases
  assert.strictEqual(clampScore(-10), 0);
  assert.strictEqual(clampScore(150), 100);
  assert.strictEqual(clampScore('abc'), 0);
  assert.strictEqual(clampScore(null), 0);
  assert.strictEqual(clampScore(undefined), 0);
  console.log('testClampScore passed.');
}

function testDeriveOverallStatus() {
  console.log('Running testDeriveOverallStatus...');

  // Blocked due to failCount
  assert.strictEqual(deriveOverallStatus({ score: 100, failCount: 1 }), 'blocked');
  assert.strictEqual(deriveOverallStatus({ score: 90, failCount: 5 }), 'blocked');

  // Blocked due to score
  assert.strictEqual(deriveOverallStatus({ score: 64, failCount: 0 }), 'blocked');
  assert.strictEqual(deriveOverallStatus({ score: 0, failCount: 0 }), 'blocked');

  // Ready
  assert.strictEqual(deriveOverallStatus({ score: 85, failCount: 0 }), 'ready');
  assert.strictEqual(deriveOverallStatus({ score: 100, failCount: 0 }), 'ready');

  // Watch
  assert.strictEqual(deriveOverallStatus({ score: 65, failCount: 0 }), 'watch');
  assert.strictEqual(deriveOverallStatus({ score: 84, failCount: 0 }), 'watch');
  assert.strictEqual(deriveOverallStatus({ score: 75, failCount: 0 }), 'watch');

  console.log('testDeriveOverallStatus passed.');
}

try {
  testChecklistKeys();
  testClampScore();
  testDeriveOverallStatus();
  console.log('All superadminPilotReadiness.helpers tests passed.');
} catch (err) {
  console.error('Test failed:', err);
  process.exit(1);
}
