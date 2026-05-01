#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
let updatedFirmId = null;
let resolvedCalls = 0;

Module._load = function(request, parent, isMain) {
  if (request === '../models/TenantStorageConfig.model') {
    return {
      updateMany: async () => {},
      findOneAndUpdate: async () => ({ _id: 'cfg1', compressionEnabled: true, compressionLevel: 6 }),
    };
  }
  if (request === '../models/Firm.model') {
    return { findByIdAndUpdate: async (id) => { updatedFirmId = id; } };
  }
  if (request === '../services/storage/services/TokenEncryption.service') {
    return { encrypt: (v) => `enc:${v}` };
  }
  if (request === '../services/storage/errors') {
    return { UnsupportedProviderError: class UnsupportedProviderError extends Error {} };
  }
  if (request === '../services/tenantIdentity.service') {
    return { resolveStorageContextFromTenantId: async () => { resolvedCalls += 1; return { ownershipFirmId: 'firm-owner-1' }; } };
  }
  if (request === '../utils/log') return { info: () => {}, error: () => {} };
  return originalLoad.apply(this, arguments);
};

const { updateTenantStorage } = require('../src/controllers/tenantStorage.controller');

async function run() {
  const req = {
    firmId: 'tenant-default-1',
    body: { provider: 'google_drive', refreshToken: 'rtok' },
    user: { _id: { toString: () => 'u1' } },
  };
  const res = { statusCode: 200, body: null, status(c){ this.statusCode = c; return this; }, json(p){ this.body = p; return this; } };
  await updateTenantStorage(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(updatedFirmId, 'firm-owner-1');
  assert.strictEqual(resolvedCalls, 1);

  console.log('tenantStorageOwnershipBoundary.test.js passed');
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(() => { Module._load = originalLoad; });
