#!/usr/bin/env node
/**
 * Pure Platform RBAC & Firm Lifecycle Tests
 *
 * Validates:
 * 1. SuperAdmin → switch-to-firm → 403 (impersonation removed)
 * 2. Deactivate ACTIVE firm → 200
 * 3. Deactivate INACTIVE firm → 400
 * 4. Activate INACTIVE firm → 200
 * 5. Activate ACTIVE firm → 400
 * 6. requirePlatformSuperAdmin: non-SuperAdmin → 403
 * 7. requireFirmUser: SuperAdmin → 403
 */

const assert = require('assert');
const mongoose = require('mongoose');

// ── Minimal mock helpers ────────────────────────────────────────────────────

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const runMiddleware = async (mw, req) => {
  const res = createRes();
  let nextCalled = false;
  await mw(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
};

// ── Stub models ─────────────────────────────────────────────────────────────

const mockFirms = new Map();

const mockFirmModel = {
  findById: async (id) => mockFirms.get(id.toString()),
};

const mockAuditLogs = [];
const mockSuperadminAudit = {
  create: async (data) => { mockAuditLogs.push(data); },
};

require.cache[require.resolve('../src/models/Firm.model')] = { exports: mockFirmModel };
require.cache[require.resolve('../src/models/SuperadminAudit.model')] = { exports: mockSuperadminAudit };

// ── Load modules under test ──────────────────────────────────────────────────

// wrapWriteHandler needs to be transparent in tests (no transaction)
const transactionGuards = require('../src/utils/transactionGuards');
const originalWrap = transactionGuards.wrapWriteHandler;
transactionGuards.wrapWriteHandler = (fn) => fn; // bypass transaction wrapper

const { switchFirm, activateFirm, deactivateFirm } = require('../src/controllers/superadmin.controller');
const { requirePlatformSuperAdmin, requireFirmUser } = require('../src/middleware/permission.middleware');

// Restore after loading
transactionGuards.wrapWriteHandler = originalWrap;

const superAdminUser = {
  _id: new mongoose.Types.ObjectId().toString(),
  email: 'superadmin@docketra.local',
  role: 'SuperAdmin',
};

const firmUser = {
  _id: new mongoose.Types.ObjectId().toString(),
  email: 'admin@firm.com',
  role: 'Admin',
  firmId: new mongoose.Types.ObjectId().toString(),
};

// ── Test 1: SuperAdmin switch-to-firm → 403 ──────────────────────────────────

async function testSwitchFirmReturns403() {
  console.log('\n[TEST 1] SuperAdmin switch-to-firm returns 403...');

  const req = {
    body: { firmId: new mongoose.Types.ObjectId().toString(), mode: 'READ_ONLY' },
    user: superAdminUser,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test' },
  };
  const res = createRes();
  await switchFirm(req, res, () => {});

  assert.strictEqual(res.statusCode, 403, 'switchFirm must return 403');
  assert.strictEqual(res.body.success, false);
  assert.ok(res.body.message, 'Response must include a message');
  console.log('  ✓ switchFirm returns 403 for SuperAdmin');
}

// ── Tests 2–5: Firm lifecycle ─────────────────────────────────────────────────

function makeFirm(status) {
  const id = new mongoose.Types.ObjectId();
  const firm = {
    _id: id,
    firmId: 'FIRM001',
    name: 'Test Firm',
    status,
    save: async function () { mockFirms.set(this._id.toString(), this); },
  };
  mockFirms.set(id.toString(), firm);
  return firm;
}

const makeReq = (firmId) => ({
  params: { id: firmId },
  body: {},
  user: superAdminUser,
  ip: '127.0.0.1',
  headers: { 'user-agent': 'test' },
  skipTransaction: true,
});

async function testDeactivateActiveFirm() {
  console.log('\n[TEST 2] Deactivate ACTIVE firm → 200...');
  const firm = makeFirm('ACTIVE');
  const req = makeReq(firm._id.toString());
  const res = createRes();
  await deactivateFirm(req, res, () => {});
  assert.strictEqual(res.statusCode, 200, 'Should return 200');
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.status, 'INACTIVE', 'Status should be INACTIVE');
  console.log('  ✓ Deactivate ACTIVE firm returns 200 with INACTIVE status');
}

async function testDeactivateInactiveFirm() {
  console.log('\n[TEST 3] Deactivate INACTIVE firm → 400...');
  const firm = makeFirm('INACTIVE');
  const req = makeReq(firm._id.toString());
  const res = createRes();
  await deactivateFirm(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Should return 400');
  assert.strictEqual(res.body.success, false);
  console.log('  ✓ Deactivate INACTIVE firm returns 400');
}

async function testActivateInactiveFirm() {
  console.log('\n[TEST 4] Activate INACTIVE firm → 200...');
  const firm = makeFirm('INACTIVE');
  const req = makeReq(firm._id.toString());
  const res = createRes();
  await activateFirm(req, res, () => {});
  assert.strictEqual(res.statusCode, 200, 'Should return 200');
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.status, 'ACTIVE', 'Status should be ACTIVE');
  console.log('  ✓ Activate INACTIVE firm returns 200 with ACTIVE status');
}

async function testActivateActiveFirm() {
  console.log('\n[TEST 5] Activate ACTIVE firm → 400...');
  const firm = makeFirm('ACTIVE');
  const req = makeReq(firm._id.toString());
  const res = createRes();
  await activateFirm(req, res, () => {});
  assert.strictEqual(res.statusCode, 400, 'Should return 400');
  assert.strictEqual(res.body.success, false);
  console.log('  ✓ Activate ACTIVE firm returns 400');
}

// ── Tests 6–7: Middleware RBAC ───────────────────────────────────────────────

async function testRequirePlatformSuperAdminBlocksFirmUser() {
  console.log('\n[TEST 6] requirePlatformSuperAdmin blocks firm user → 403...');
  const req = { user: firmUser };
  const { res, nextCalled } = await runMiddleware(requirePlatformSuperAdmin, req);
  assert.strictEqual(res.statusCode, 403, 'Should return 403');
  assert.strictEqual(nextCalled, false, 'next() should not be called');
  console.log('  ✓ requirePlatformSuperAdmin blocks non-SuperAdmin with 403');
}

async function testRequirePlatformSuperAdminAllowsSuperAdmin() {
  console.log('\n[TEST 6b] requirePlatformSuperAdmin allows SuperAdmin...');
  const req = { user: superAdminUser };
  const { res, nextCalled } = await runMiddleware(requirePlatformSuperAdmin, req);
  assert.strictEqual(nextCalled, true, 'next() should be called for SuperAdmin');
  console.log('  ✓ requirePlatformSuperAdmin allows SuperAdmin');
}

async function testRequireFirmUserBlocksSuperAdmin() {
  console.log('\n[TEST 7] requireFirmUser blocks SuperAdmin → 403...');
  const req = { user: superAdminUser };
  const { res, nextCalled } = await runMiddleware(requireFirmUser, req);
  assert.strictEqual(res.statusCode, 403, 'Should return 403');
  assert.strictEqual(nextCalled, false, 'next() should not be called');
  console.log('  ✓ requireFirmUser blocks SuperAdmin with 403');
}

async function testRequireFirmUserAllowsFirmUser() {
  console.log('\n[TEST 7b] requireFirmUser allows firm user...');
  const req = { user: firmUser };
  const { res, nextCalled } = await runMiddleware(requireFirmUser, req);
  assert.strictEqual(nextCalled, true, 'next() should be called for firm user');
  console.log('  ✓ requireFirmUser allows firm user');
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Pure Platform RBAC Tests ===');
  let passed = 0;
  let failed = 0;

  const tests = [
    testSwitchFirmReturns403,
    testDeactivateActiveFirm,
    testDeactivateInactiveFirm,
    testActivateInactiveFirm,
    testActivateActiveFirm,
    testRequirePlatformSuperAdminBlocksFirmUser,
    testRequirePlatformSuperAdminAllowsSuperAdmin,
    testRequireFirmUserBlocksSuperAdmin,
    testRequireFirmUserAllowsFirmUser,
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.error(`  ✗ FAILED: ${test.name}`);
      console.error('   ', err.message);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});
