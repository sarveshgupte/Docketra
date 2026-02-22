#!/usr/bin/env node
/**
 * Tests for tenantResolver middleware
 *
 * Uses model stubs to avoid a live DB dependency.
 * Follows the same pattern as firmRbac.test.js.
 */

const assert = require('assert');
const Firm = require('../src/models/Firm.model');
const tenantResolver = require('../src/middleware/tenantResolver');

const OBJECT_ID_ACTIVE = '507f1f77bcf86cd799439011';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createRes = () => ({
  statusCode: null,
  body: null,
  sent: false,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; this.sent = true; return this; },
});

const runMiddleware = async (req) => {
  const res = createRes();
  let nextCalled = false;
  await tenantResolver(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
};

// ---------------------------------------------------------------------------
// Test: missing firmSlug calls next() without error
// ---------------------------------------------------------------------------
async function shouldCallNextWhenNoSlug() {
  const req = { params: {} };
  const { nextCalled, res } = await runMiddleware(req);
  assert.strictEqual(nextCalled, true, 'next() should be called when firmSlug is absent');
  assert.strictEqual(res.sent, false, 'No response should be sent');
  console.log('✓ Missing firmSlug calls next()');
}

// ---------------------------------------------------------------------------
// Test: active firm resolves correctly
// ---------------------------------------------------------------------------
async function shouldResolveFirmContext() {
  const originalFindOne = Firm.findOne;
  Firm.findOne = async () => ({
    _id: { toString: () => OBJECT_ID_ACTIVE },
    firmId: 'FIRM001',
    firmSlug: 'test-firm',
    name: 'Test Firm',
    status: 'ACTIVE',
  });

  const req = { params: { firmSlug: 'test-firm' } };
  const { nextCalled, res } = await runMiddleware(req);

  assert.strictEqual(nextCalled, true, 'next() should be called for an active firm');
  assert.strictEqual(res.sent, false, 'No error response should be sent');
  assert.strictEqual(req.firmSlug, 'test-firm', 'req.firmSlug should be set');
  assert.ok(req.firmId, 'req.firmId should be set');
  assert.strictEqual(req.firm.status, 'ACTIVE', 'req.firm.status should be ACTIVE');
  console.log('✓ Active firm resolves correctly');

  Firm.findOne = originalFindOne;
}

// ---------------------------------------------------------------------------
// Test: uppercase slug is normalised and resolved
// ---------------------------------------------------------------------------
async function shouldNormalizeUppercaseSlug() {
  const originalFindOne = Firm.findOne;
  let queriedSlug = null;
  Firm.findOne = async (filter) => {
    queriedSlug = filter.firmSlug;
    return {
      _id: { toString: () => OBJECT_ID_ACTIVE },
      firmId: 'FIRM001',
      firmSlug: 'test-firm',
      name: 'Test Firm',
      status: 'ACTIVE',
    };
  };

  const req = { params: { firmSlug: 'TEST-FIRM' } };
  const { nextCalled } = await runMiddleware(req);

  assert.strictEqual(nextCalled, true, 'Should resolve even with uppercase slug in URL');
  assert.strictEqual(queriedSlug, 'test-firm', 'Query must use normalised (lowercase) slug');
  console.log('✓ Uppercase slug is normalised before DB lookup');

  Firm.findOne = originalFindOne;
}

// ---------------------------------------------------------------------------
// Test: unknown slug → 404
// ---------------------------------------------------------------------------
async function shouldReturn404ForUnknownSlug() {
  const originalFindOne = Firm.findOne;
  Firm.findOne = async () => null;

  const req = { params: { firmSlug: 'does-not-exist' } };
  const { res, nextCalled } = await runMiddleware(req);

  assert.strictEqual(nextCalled, false, 'next() should NOT be called for an unknown firm');
  assert.strictEqual(res.statusCode, 404, 'Should return 404 for unknown slug');
  assert.strictEqual(res.body.code, 'FIRM_NOT_FOUND');
  console.log('✓ Wrong slug returns 404');

  Firm.findOne = originalFindOne;
}

// ---------------------------------------------------------------------------
// Test: inactive firm → 403
// ---------------------------------------------------------------------------
async function shouldReturn403ForInactiveFirm() {
  const originalFindOne = Firm.findOne;
  Firm.findOne = async () => ({
    _id: { toString: () => OBJECT_ID_ACTIVE },
    firmId: 'FIRM001',
    firmSlug: 'inactive-firm',
    name: 'Inactive Firm',
    status: 'INACTIVE',
  });

  const req = { params: { firmSlug: 'inactive-firm' } };
  const { res, nextCalled } = await runMiddleware(req);

  assert.strictEqual(nextCalled, false, 'next() should NOT be called for an inactive firm');
  assert.strictEqual(res.statusCode, 403, 'Should return 403 for inactive firm');
  assert.strictEqual(res.body.code, 'FIRM_INACTIVE');
  console.log('✓ Inactive firm returns 403');

  Firm.findOne = originalFindOne;
}

// ---------------------------------------------------------------------------
// Test: suspended firm → 403
// ---------------------------------------------------------------------------
async function shouldReturn403ForSuspendedFirm() {
  const originalFindOne = Firm.findOne;
  Firm.findOne = async () => ({
    _id: { toString: () => OBJECT_ID_ACTIVE },
    firmId: 'FIRM001',
    firmSlug: 'suspended-firm',
    name: 'Suspended Firm',
    status: 'SUSPENDED',
  });

  const req = { params: { firmSlug: 'suspended-firm' } };
  const { res, nextCalled } = await runMiddleware(req);

  assert.strictEqual(nextCalled, false, 'next() should NOT be called for a suspended firm');
  assert.strictEqual(res.statusCode, 403, 'Should return 403 for suspended firm');
  assert.strictEqual(res.body.code, 'FIRM_SUSPENDED');
  console.log('✓ Suspended firm returns 403');

  Firm.findOne = originalFindOne;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function run() {
  console.log('='.repeat(60));
  console.log('tenantResolver middleware tests');
  console.log('='.repeat(60));

  await shouldCallNextWhenNoSlug();
  await shouldResolveFirmContext();
  await shouldNormalizeUppercaseSlug();
  await shouldReturn404ForUnknownSlug();
  await shouldReturn403ForInactiveFirm();
  await shouldReturn403ForSuspendedFirm();

  console.log('\nAll tenantResolver tests passed.');
}

run().catch((err) => {
  console.error('tenantResolver tests failed:', err);
  process.exit(1);
});
