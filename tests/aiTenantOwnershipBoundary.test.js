#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

async function run() {
  let updatedFirmId = null;
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Firm.model') {
      return {
        findById: () => ({ select() { return this; }, lean: async () => ({ aiConfig: {} }) }),
        findByIdAndUpdate: async (id) => { updatedFirmId = id; },
      };
    }
    if (request === '../services/tenantIdentity.service') {
      return { resolveStorageContextFromTenantId: async (tenantId) => ({ tenantId, ownershipFirmId: 'firm-owner-1' }) };
    }
    if (request === '../utils/encryption') return { encrypt: (v) => `enc:${v}` };
    if (request === '../utils/log') return { warn: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/controllers/ai.controller');
  const { setAiConfig } = require('../src/controllers/ai.controller');

  const req = { firmId: 'tenant-default-1', body: { provider: 'openai', apiKey: '<dummy-api-key>', settings: {} } };
  const res = { statusCode: 200, payload: null, status(c) { this.statusCode = c; return this; }, json(p) { this.payload = p; return this; } };
  await setAiConfig(req, res);

  assert.strictEqual(updatedFirmId, 'firm-owner-1');
  assert.strictEqual(res.statusCode, 200);
  console.log('aiTenantOwnershipBoundary.test.js passed');
}
run().catch((e) => { console.error(e); process.exit(1); }).finally(() => { Module._load = originalLoad; });
