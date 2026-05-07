#!/usr/bin/env node
const assert = require('node:assert/strict');
const path = require('node:path');

const rootPackage = require(path.join(__dirname, '..', 'package.json'));
const command = String(rootPackage?.scripts?.['test:pilot-hardening'] || '');

for (const requiredFragment of [
  'tests/pilotRouteSchemaAudit.test.js',
  'tests/frontendBackendApiParity.test.js',
  'ui run test:pilot-ui-contracts',
]) {
  assert.ok(command.includes(requiredFragment), `test:pilot-hardening must include: ${requiredFragment}`);
}

console.log('pilotHardeningScriptContract.test.js passed');
