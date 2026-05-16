#!/usr/bin/env node
const assert = require('assert');

const teamSchemas = require('../src/schemas/team.routes.schema');
const clientSchemas = require('../src/schemas/client.routes.schema');
const authSchemas = require('../src/schemas/auth.routes.schema');

function shouldRejectUnknownKeys(schema, payload, label) {
  const result = schema.safeParse(payload);
  assert.strictEqual(result.success, false, `${label} should reject unknown keys`);
}

function shouldAccept(schema, payload, label) {
  const result = schema.safeParse(payload);
  assert.strictEqual(result.success, true, `${label} should accept valid payload`);
}

(function run() {

  // GET list query remains intentionally permissive for backward compatibility.
  shouldAccept(teamSchemas['GET /'].query, { page: '2', limit: '20', q: 'ops' }, 'team list query compatibility');
  shouldAccept(teamSchemas['POST /'].body, { name: 'Core Team', managerId: '507f1f77bcf86cd799439011' }, 'team create');
  shouldRejectUnknownKeys(teamSchemas['POST /'].body, { name: 'Core Team', firmId: 'override' }, 'team create');

  shouldRejectUnknownKeys(
    teamSchemas['PATCH /:id'].body,
    { name: 'Updated Team', updatedBy: 'attacker' },
    'team update'
  );

  shouldRejectUnknownKeys(
    clientSchemas['POST /:clientId/cfs/comments'].body,
    { commentText: 'Looks good', createdBy: 'attacker' },
    'client cfs comment create'
  );

  shouldRejectUnknownKeys(
    authSchemas['POST /resend-credentials'].body,
    { email: 'user@example.com', role: 'SUPERADMIN' },
    'auth resend credentials'
  );

  console.log('inputValidationHardening.schema.test.js passed');
})();
