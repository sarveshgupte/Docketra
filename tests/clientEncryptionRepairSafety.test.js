#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
const controllerPath = require.resolve('../src/controllers/client.controller');

const makeRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
  set() { return this; },
});

const clear = () => { delete require.cache[controllerPath]; };

async function testBlocksWhenEncryptedDataExistsUnderRootCandidate() {
  let ensureCalled = false;
  Module._load = function(request, parent, isMain) {
    if (request === '../repositories/ClientRepository') {
      return {
        count: async (firmId) => (String(firmId) === 'root-tenant' ? 2 : 0),
      };
    }
    if (request === '../security/encryption.service') {
      return {
        ensureTenantKey: async () => { ensureCalled = true; },
        resolveTenantKeyTenantId: async () => null,
        resolveTenantKeyCandidates: async () => ['workspace-tenant', 'root-tenant'],
      };
    }
    if (request === '../services/firmMemoryScope.service') return { resolveFirmMemoryScope: () => ({ hasFirmWideAccess: true, scopedClientIds: [] }) };
    if (request === '../utils/log') return { info() {}, warn() {}, error() {} };
    if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
    if (request.includes('../') || request.includes('./')) {
      try { return originalLoad.apply(this, arguments); } catch (_) { return {}; }
    }
    return originalLoad.apply(this, arguments);
  };

  clear();
  const { repairClientEncryptionKey } = require('../src/controllers/client.controller');
  const req = { user: { firmId: 'workspace-tenant', role: 'ADMIN' }, headers: {}, query: {} };
  const res = makeRes();
  await repairClientEncryptionKey(req, res);
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.code, 'TENANT_KEY_REPAIR_BLOCKED');
  assert.strictEqual(ensureCalled, false);
}

async function testCreatesSingleKeyUnderCanonicalTenantWhenSafe() {
  let ensuredTenantId = null;
  Module._load = function(request, parent, isMain) {
    if (request === '../repositories/ClientRepository') {
      return { count: async () => 0 };
    }
    if (request === '../security/encryption.service') {
      return {
        ensureTenantKey: async (tenantId) => { ensuredTenantId = String(tenantId); },
        resolveTenantKeyTenantId: async () => null,
        resolveTenantKeyCandidates: async () => ['workspace-tenant', 'root-tenant', 'legacy-tenant'],
      };
    }
    if (request === '../services/firmMemoryScope.service') return { resolveFirmMemoryScope: () => ({ hasFirmWideAccess: true, scopedClientIds: [] }) };
    if (request === '../utils/log') return { info() {}, warn() {}, error() {} };
    if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
    if (request.includes('../') || request.includes('./')) {
      try { return originalLoad.apply(this, arguments); } catch (_) { return {}; }
    }
    return originalLoad.apply(this, arguments);
  };

  clear();
  const { repairClientEncryptionKey } = require('../src/controllers/client.controller');
  const req = { user: { firmId: 'workspace-tenant', role: 'PRIMARY_ADMIN' }, headers: {}, query: {} };
  const res = makeRes();
  await repairClientEncryptionKey(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.repaired, true);
  assert.strictEqual(ensuredTenantId, 'workspace-tenant');
}

(async () => {
  try {
    await testBlocksWhenEncryptedDataExistsUnderRootCandidate();
    await testCreatesSingleKeyUnderCanonicalTenantWhenSafe();
    console.log('clientEncryptionRepairSafety.test.js passed');
  } finally {
    Module._load = originalLoad;
    clear();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
