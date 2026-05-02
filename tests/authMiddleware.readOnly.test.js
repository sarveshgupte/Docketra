const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clear = (p) => { try { delete require.cache[require.resolve(p)]; } catch (_) {} };

async function run() {
  let saveCalled = 0;
  let getOrCreateCalled = 0;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async () => ({
          _id: { toString: () => 'user-1' },
          xID: 'X000001',
          email: 'user@example.com',
          role: 'Admin',
          status: 'active',
          mustSetPassword: false,
          mustChangePassword: false,
          firmId: { toString: () => 'tenant-1' },
          defaultClientId: { toString: () => 'client-1' },
          toObject() { return this; },
          async save() { saveCalled += 1; return this; },
        }),
      };
    }

    if (request === '../models/Client.model') {
      return {
        findOne: () => ({ select() { return this; }, lean: async () => ({ status: 'active', isDefaultClient: true }) }),
      };
    }
    if (request === '../services/jwt.service') {
      return { verifyAccessToken: () => ({ userId: 'user-1', role: 'Admin', firmId: 'tenant-1', defaultClientId: 'client-1' }) };
    }
    if (request === '../services/defaultClient.guard') {
      return { getOrCreateDefaultClient: async () => { getOrCreateCalled += 1; return { _id: 'client-1' }; } };
    }
    if (request === '../services/tenantIdentity.service') {
      return { resolveCanonicalTenantForUser: async () => ({ tenantId: 'tenant-1', defaultClientId: 'client-1', firmSlug: 'firm-a' }) };
    }
    if (request === '../services/metrics.service') {
      return { recordAuthFailure: () => {} };
    }
    if (request === '../utils/log') return { info: () => {}, warn: () => {}, error: () => {} };
    if (request === '../config/env') return { loadEnv: () => ({}) };
    if (request === './supportHeaders') return { applySupportHeadersToContext: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/middleware/auth.middleware');
  const { authenticate } = require('../src/middleware/auth.middleware');

  const req = { method: 'GET', headers: { authorization: 'Bearer ok' }, cookies: {}, originalUrl: '/api/auth/profile', url: '/api/auth/profile' };
  const res = { statusCode: 200, body: null, status(c){ this.statusCode = c; return this; }, json(b){ this.body = b; return b; } };
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true, 'authenticate should succeed for valid tenant context');
  assert.strictEqual(saveCalled, 0, 'authenticate must not call user.save');
  assert.strictEqual(getOrCreateCalled, 0, 'authenticate must not attempt default-client repair');

  Module._load = originalLoad;
  clear('../src/middleware/auth.middleware');

  // fail-closed check for missing tenant/default client
  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async () => ({
          _id: { toString: () => 'user-2' },
          xID: 'X000002',
          email: 'user2@example.com',
          role: 'Admin',
          status: 'active',
          mustSetPassword: false,
          mustChangePassword: false,
          firmId: null,
          defaultClientId: null,
          toObject() { return this; },
        }),
      };
    }

    if (request === '../models/Client.model') {
      return {
        findOne: () => ({ select() { return this; }, lean: async () => null }),
      };
    }
    if (request === '../services/jwt.service') return { verifyAccessToken: () => ({ userId: 'user-2', role: 'Admin' }) };
    if (request === '../services/tenantIdentity.service') return { resolveCanonicalTenantForUser: async () => ({ tenantId: null, defaultClientId: null }) };
    if (request === '../services/metrics.service') return { recordAuthFailure: () => {} };
    if (request === '../utils/log') return { info: () => {}, warn: () => {}, error: () => {} };
    if (request === '../config/env') return { loadEnv: () => ({}) };
    if (request === './supportHeaders') return { applySupportHeadersToContext: () => {} };
    return originalLoad.apply(this, arguments);
  };

  clear('../src/middleware/auth.middleware');
  const { authenticate: authenticateFailClosed } = require('../src/middleware/auth.middleware');
  const req2 = { method: 'GET', headers: { authorization: 'Bearer ok' }, cookies: {}, originalUrl: '/api/tenant/data', url: '/api/tenant/data' };
  const res2 = { statusCode: 200, body: null, status(c){ this.statusCode = c; return this; }, json(b){ this.body = b; return b; } };
  let nextCalled2 = false;
  await authenticateFailClosed(req2, res2, () => { nextCalled2 = true; });

  assert.strictEqual(nextCalled2, false);
  assert.strictEqual(res2.statusCode, 403);
  assert.strictEqual(res2.body?.code, 'TENANT_CONTEXT_REQUIRED');

  Module._load = originalLoad;
  clear('../src/middleware/auth.middleware');
  console.log('authMiddleware.readOnly.test.js passed');
}

run().catch((err) => {
  Module._load = originalLoad;
  console.error(err);
  process.exit(1);
});
