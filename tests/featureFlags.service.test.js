#!/usr/bin/env node
const assert = require('assert');
const featureFlags = require('../src/services/featureFlags.service');
const featureGate = require('../src/services/featureGate.service');

function testExports() {
  const expectedExports = [
    'isFirmCreationDisabled',
    'areFileUploadsDisabled',
    'isExternalStorageEnabled',
    'ensureFirmCreationEnabled',
    'ensureFileUploadsEnabled',
  ];

  expectedExports.forEach((fnName) => {
    assert.strictEqual(
      typeof featureFlags[fnName],
      'function',
      `featureFlags.${fnName} should be a function`
    );
    assert.strictEqual(
      featureFlags[fnName],
      featureGate[fnName],
      `featureFlags.${fnName} should be the same as featureGate.${fnName}`
    );
  });

  // Ensure no unexpected exports
  const actualExports = Object.keys(featureFlags);
  assert.strictEqual(
    actualExports.length,
    expectedExports.length,
    'featureFlags should only export the expected number of functions'
  );
}

function run() {
  try {
    testExports();
    console.log('Feature flags service tests passed.');
  } catch (err) {
    console.error('Feature flags service tests failed:', err);
    process.exit(1);
  }
}

run();
