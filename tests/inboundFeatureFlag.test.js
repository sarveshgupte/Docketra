#!/usr/bin/env node
'use strict';

const assert = require('assert');
const featureFlags = require('../src/services/featureFlags.service');

function runScenario(value, expected, label) {
  const original = process.env.ENABLE_INBOUND_EMAIL;
  if (value === undefined) {
    delete process.env.ENABLE_INBOUND_EMAIL;
  } else {
    process.env.ENABLE_INBOUND_EMAIL = value;
  }

  try {
    assert.strictEqual(featureFlags.isInboundEmailEnabled(), expected, label);
  } finally {
    if (original === undefined) {
      delete process.env.ENABLE_INBOUND_EMAIL;
    } else {
      process.env.ENABLE_INBOUND_EMAIL = original;
    }
  }
}

runScenario(undefined, false, 'Inbound email should default to disabled');
runScenario('false', false, 'Inbound email should stay disabled when explicitly false');
runScenario('true', true, 'Inbound email should enable only when flag is true');

console.log('Inbound feature flag tests passed.');
