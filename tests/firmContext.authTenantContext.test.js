#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

function resMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function run() {
  let resolverCalls = 0;

  Module._load = function(request) {
    if (request === '../services/tenantIdentity.service') {
      return {
        resolveCanonicalTenantFromFirmId: async (firmId) => {
          resolverCalls += 1;
          return {
            tenantId: String(firmId),
            ownershipFirmId: '507f1f77bcf86cd799439099',
            defaultClientId: String(firmId),
            firmSlug: 'tenant-a',
            status: 'active',
          };
        },
      };
    }
    if (request === '../utils/log') return { info: () => {}, warn: () => {}, error: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/middleware/firmContext');
  const { firmContext } = require('../src/middleware/firmContext');

  // reuse authTenantContext and skip resolver
  {
    resolverCalls = 0;
    const firmId = '507f1f77bcf86cd799439011';
    const req = {
      method: 'GET', originalUrl: '/api/tenant/data',
      jwt: { firmId }, user: { role: 'Admin', firmId },
      authTenantContext: Object.freeze({
        tenantId: firmId,
        defaultClientId: firmId,
        firmSlug: 'tenant-a',
        ownershipFirmId: '507f1f77bcf86cd799439099',
        status: 'active',
      }),
    };
    const res = resMock();
    let nextCalled = false;
    await firmContext(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(resolverCalls, 0);
  }

  // fallback when missing authTenantContext
  {
    resolverCalls = 0;
    const firmId = '507f1f77bcf86cd799439012';
    const req = { method: 'GET', originalUrl: '/api/tenant/data', jwt: { firmId }, user: { role: 'Admin', firmId } };
    const res = resMock();
    let nextCalled = false;
    await firmContext(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(resolverCalls, 1);
  }

  // mismatch returns 403
  {
    const req = {
      method: 'GET', originalUrl: '/api/tenant/data',
      jwt: { firmId: '507f1f77bcf86cd799439013' },
      user: { role: 'Admin', firmId: '507f1f77bcf86cd799439013' },
      authTenantContext: Object.freeze({
        tenantId: '507f1f77bcf86cd799439099', ownershipFirmId: '507f1f77bcf86cd799439099', status: 'active',
      }),
    };
    const res = resMock();
    let nextCalled = false;
    await firmContext(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  }

  // superadmin still blocked
  {
    const req = {
      method: 'GET', originalUrl: '/api/tenant/data',
      jwt: { isSuperAdmin: true, firmId: null },
      user: { role: 'SuperAdmin', firmId: null },
      isSuperAdmin: true,
    };
    const res = resMock();
    await firmContext(req, res, () => { throw new Error('should not call next'); });
    assert.strictEqual(res.statusCode, 403);
  }

  // inactive tenant rejected even when context present
  {
    const firmId = '507f1f77bcf86cd799439014';
    const req = {
      method: 'GET', originalUrl: '/api/tenant/data',
      jwt: { firmId }, user: { role: 'Admin', firmId },
      authTenantContext: Object.freeze({ tenantId: firmId, ownershipFirmId: '507f1f77bcf86cd799439099', status: 'suspended' }),
    };
    const res = resMock();
    let nextCalled = false;
    await firmContext(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  }

  Module._load = originalLoad;
  clear('../src/middleware/firmContext');
  console.log('firmContext.authTenantContext.test.js passed');
}

run().catch((err) => {
  Module._load = originalLoad;
  clear('../src/middleware/firmContext');
  console.error(err);
  process.exit(1);
});
