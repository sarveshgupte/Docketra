#!/usr/bin/env node
const assert = require('assert');
const Firm = require('../src/models/Firm.model');

function run() {
  const planPath = Firm.schema.path('plan');
  const maxUsersPath = Firm.schema.path('maxUsers');

  const planEnum = planPath.enumValues;
  assert(planEnum.includes('pilot'), 'Expected plan enum to include pilot');
  assert(planEnum.includes('starter'), 'Expected plan enum to include starter');
  assert(planEnum.includes('professional'), 'Expected plan enum to include professional');
  assert(planEnum.includes('enterprise'), 'Expected plan enum to include enterprise');

  const firm = new Firm({ name: 'Pilot Firm', firmId: 'FIRM123', firmSlug: 'pilot-firm' });
  assert.strictEqual(firm.plan, 'pilot', 'Expected default plan to be pilot');
  assert.strictEqual(maxUsersPath.defaultValue, 25, 'Expected default maxUsers to be 25');

  const legacy = new Firm({ name: 'Legacy Firm', firmId: 'FIRM124', firmSlug: 'legacy-firm', plan: 'STARTER' });
  const validationErr = legacy.validateSync();
  assert(!validationErr, 'Expected uppercase starter input to validate');

  console.log('Firm plan defaults test passed.');
}

try {
  run();
} catch (error) {
  console.error('Firm plan defaults test failed:', error);
  process.exit(1);
}
