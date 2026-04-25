#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore
  }
};

async function testSignupBootstrapUsesDefaultClientAsRuntimeTenant() {
  let ensuredTenantKey = null;
  let generatedClientScope = null;
  let generatedXidScope = null;
  let setupFirmScope = null;
  let userCreatePayload = null;
  let defaultClientCreatePayload = null;

  Module._load = function(request, parent, isMain) {
    if (request === 'bcrypt') {
      return { hash: async () => 'hash', compare: async () => true };
    }
    if (request === 'mongoose') {
      return {
        Types: {
          ObjectId: class ObjectId {
            constructor() {
              this.value = 'tenant-client-id';
            }
            toString() {
              return this.value;
            }
            valueOf() {
              return this.value;
            }
          },
        },
      };
    }
    if (request === '../models/Firm.model') {
      return {
        findOne: () => ({
          sort: async () => null,
          session() { return this; },
        }),
        find: () => ({
          session() { return this; },
          select: async () => [],
        }),
        create: async ([payload]) => [{
          _id: 'legacy-firm-id',
          ...payload,
          save: async function save() {
            return this;
          },
        }],
      };
    }
    if (request === '../models/Client.model') {
      return {
        create: async ([payload]) => {
          defaultClientCreatePayload = payload;
          return [{
            ...payload,
            _id: payload._id,
          }];
        },
      };
    }
    if (request === '../models/User.model') {
      return {
        create: async ([payload]) => {
          userCreatePayload = payload;
          return [{ _id: 'user-1', ...payload }];
        },
      };
    }
    if (request === '../models/SignupSession.model') {
      return {
        findOne: () => ({ session: async () => null }),
        create: async () => {},
        deleteMany: async () => {},
        deleteOne: async () => {},
      };
    }
    if (request === './xIDGenerator') {
      return {
        generateNextXID: async (firmId) => {
          generatedXidScope = String(firmId);
          return 'X000001';
        },
      };
    }
    if (request === '../security/encryption.service') {
      return {
        ensureTenantKey: async (tenantId) => {
          ensuredTenantKey = String(tenantId);
        },
      };
    }
    if (request === './clientIdGenerator') {
      return {
        generateNextClientId: async (firmId) => {
          generatedClientScope = String(firmId);
          return 'C000001';
        },
      };
    }
    if (request === './firmSetup.service') {
      return {
        setupDefaultFirm: async (firmId) => {
          setupFirmScope = String(firmId);
        },
      };
    }
    if (request === '../utils/slugify') {
      return { slugify: () => 'acme-co' };
    }
    if (request === '../config/config') {
      return { strictByos: false, security: { rateLimit: { otpVerifyBlockSeconds: 60, signupOtpMaxResends: 5, otpResendCooldownSeconds: 30 } } };
    }
    if (request === './email.service') {
      return { sendFirmSetupEmail: async () => ({ success: true }) };
    }
    if (request === './redisLock.service') {
      return { acquireLock: async () => ({ acquired: true }), releaseLock: async () => {} };
    }
    if (request === './signupRateLimit.service') {
      return {
        consumeSignupQuota: async () => ({ allowed: true }),
        consumeOtpAttempt: async () => ({ allowed: true }),
        consumeOtpResendQuota: async () => ({ allowed: true }),
        clearOtpAttempts: async () => {},
      };
    }
    if (request === './safeSideEffects.service') {
      return { safeAuditLog: async () => {}, safeQueueEmail: async () => {} };
    }
    if (request === '../utils/hierarchy.utils') {
      return { coercePrimaryAdminCreationFields: () => ({ role: 'PRIMARY_ADMIN' }) };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/signup.service');
  const signupService = require('../src/services/signup.service');
  const result = await signupService.createFirmAndAdmin({
    name: 'Admin',
    email: 'admin@example.com',
    firmName: 'Acme Co',
    passwordHash: 'hash',
    session: {},
    req: { ip: '127.0.0.1', headers: {} },
  });

  assert.strictEqual(result.firmId, result.defaultClientId, 'runtime tenant id must be the default client _id');
  assert.strictEqual(String(userCreatePayload.firmId), String(result.defaultClientId), 'admin user firmId must be canonical default client id');
  assert.strictEqual(defaultClientCreatePayload.firmId, 'legacy-firm-id', 'default client ownership firmId must remain Firm._id');
  assert.strictEqual(generatedClientScope, 'legacy-firm-id', 'client id sequence should remain firm-ownership scoped');
  assert.strictEqual(generatedXidScope, String(result.defaultClientId), 'xID sequence should use canonical tenant scope');
  assert.strictEqual(setupFirmScope, String(result.defaultClientId), 'firm setup should run under canonical tenant scope');
  assert.strictEqual(ensuredTenantKey, String(result.defaultClientId), 'tenant key should be provisioned for canonical tenant id');
  console.log('  ✓ signup preserves Client.firmId ownership while using default client _id as runtime tenant scope');
}

async function runAuthMiddlewareCase({ tokenFirmId, expectedStatusCode, expectNext }) {
  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async () => ({
          _id: 'user-1',
          xID: 'X000001',
          email: 'tenant@example.com',
          role: 'Admin',
          status: 'active',
          mustSetPassword: false,
          mustChangePassword: false,
          firmId: 'legacy-firm-id',
          defaultClientId: 'tenant-client-id',
          save: async function save() { return this; },
          toObject() { return this; },
        }),
      };
    }
    if (request === '../services/jwt.service') {
      return {
        verifyAccessToken: () => ({ userId: 'user-1', firmId: tokenFirmId, role: 'Admin' }),
      };
    }
    if (request === '../services/tenantIdentity.service') {
      return {
        resolveCanonicalTenantForUser: async () => ({
          tenantId: 'tenant-client-id',
          defaultClientId: 'tenant-client-id',
          legacyFirmId: 'legacy-firm-id',
          firmSlug: 'acme-co',
        }),
      };
    }
    if (request === '../models/Client.model') {
      return {
        findById: () => ({ select() { return this; }, lean: async () => ({ _id: 'tenant-client-id', firmId: 'tenant-client-id', isDefaultClient: true }) }),
        findOne: () => ({ select() { return this; }, lean: async () => ({ _id: 'tenant-client-id', status: 'ACTIVE', isDefaultClient: true }) }),
      };
    }
    if (request === '../services/defaultClient.guard') {
      return { getOrCreateDefaultClient: async () => ({ _id: 'tenant-client-id' }) };
    }
    if (request === '../utils/role.utils') {
      return {
        isSuperAdminRole: () => false,
        normalizeRole: (role) => role,
      };
    }
    if (request === '../config/env') {
      return { loadEnv: () => ({ SUPERADMIN_OBJECT_ID: 'super-id' }) };
    }
    if (request === '../services/metrics.service') {
      return { recordAuthFailure: () => {} };
    }
    if (request === '../utils/requestCookies') {
      return { getCookieValue: () => 'token' };
    }
    if (request === '../utils/status.utils') {
      return { isActiveStatus: () => true, getFirmInactiveCode: () => 'INACTIVE' };
    }
    if (request === './attachRequestContext') {
      return { buildRequestContext: () => ({}) };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/middleware/auth.middleware');
  const { authenticate } = require('../src/middleware/auth.middleware');
  const req = { method: 'GET', headers: { cookie: 'accessToken=token' }, originalUrl: '/api/clients', path: '/api/clients' };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, expectedStatusCode);
  assert.strictEqual(nextCalled, expectNext);
  return { req, res };
}

async function testAuthMiddlewareResolvesLegacyFirmIdToCanonicalTenant() {
  const { req } = await runAuthMiddlewareCase({
    tokenFirmId: 'tenant-client-id',
    expectedStatusCode: 200,
    expectNext: true,
  });
  assert.strictEqual(req.user.firmId, 'tenant-client-id');
  assert.strictEqual(req.jwt.firmId, 'tenant-client-id');
  assert.strictEqual(req.user.defaultClientId, 'tenant-client-id');
  console.log('  ✓ auth middleware keeps JWT/user runtime scope canonical to default client _id');
}

async function testAuthMiddlewareBlocksCrossTenantTokens() {
  const { res } = await runAuthMiddlewareCase({
    tokenFirmId: 'other-tenant-id',
    expectedStatusCode: 403,
    expectNext: false,
  });
  assert.strictEqual(res.body.message, 'Firm access violation detected.');
  console.log('  ✓ auth middleware blocks cross-tenant token scope mismatches');
}

async function testFirmSlugResolverUsesCanonicalRuntimeTenantScope() {
  Module._load = function(request, parent, isMain) {
    if (request === '../services/tenantIdentity.service') {
      return {
        resolveTenantBySlug: async () => ({
          tenantId: 'tenant-client-id',
          legacyFirmId: 'legacy-firm-id',
          firmSlug: 'acme-co',
          firmName: 'Acme Co',
          firmIdString: 'FIRM001',
          status: 'ACTIVE',
        }),
      };
    }
    if (request === '../utils/slugify') {
      return { normalizeFirmSlug: (slug) => String(slug || '').toLowerCase() };
    }
    if (request === '../utils/status.utils') {
      return { isActiveStatus: () => true, getFirmInactiveCode: () => 'INACTIVE' };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/middleware/tenantResolver');
  const tenantResolver = require('../src/middleware/tenantResolver');
  const req = { method: 'POST', params: { firmSlug: 'Acme-Co' }, path: '/login', context: {} };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let nextCalled = false;
  await tenantResolver(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.firmId, 'tenant-client-id');
  assert.strictEqual(req.firm.legacyFirmId, 'legacy-firm-id');
  console.log('  ✓ firm slug login resolves canonical runtime tenant id with legacy firm metadata');
}

async function testClientRepositoryUsesOwnershipFirmIdForQueries() {
  let findFilter = null;
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        find: (filter) => {
          findFilter = filter;
          return {
            then(resolve) {
              return Promise.resolve(resolve([
                { clientId: 'C000001', firmId: 'legacy-firm-id', isDefaultClient: true },
                { clientId: 'C000002', firmId: 'legacy-firm-id', isDefaultClient: false },
              ]));
            },
          };
        },
      };
    }
    if (request === '../security/encryption.service') {
      return { decrypt: async (v) => v, ensureTenantKey: async () => {}, ForbiddenError: class ForbiddenError extends Error {} };
    }
    if (request === '../security/encryption.utils') {
      return { looksEncrypted: () => false };
    }
    if (request === '../services/tenantIdentity.service') {
      return { resolveClientOwnershipFirmId: async () => 'legacy-firm-id' };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/repositories/ClientRepository');
  const ClientRepository = require('../src/repositories/ClientRepository');
  const docs = await ClientRepository.find('tenant-client-id', { status: 'active' }, 'Admin');

  assert.strictEqual(findFilter.firmId, 'legacy-firm-id');
  assert.strictEqual(Array.isArray(docs), true);
  assert.strictEqual(docs.length, 2);
  console.log('  ✓ client repository maps runtime tenant to ownership firmId for client list queries');
}

async function run() {
  console.log('Running canonical tenant identity tests...');
  try {
    await testSignupBootstrapUsesDefaultClientAsRuntimeTenant();
    await testAuthMiddlewareResolvesLegacyFirmIdToCanonicalTenant();
    await testFirmSlugResolverUsesCanonicalRuntimeTenantScope();
    await testAuthMiddlewareBlocksCrossTenantTokens();
    await testClientRepositoryUsesOwnershipFirmIdForQueries();
    console.log('Canonical tenant identity tests passed.');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  console.error('Canonical tenant identity tests failed:', error);
  Module._load = originalLoad;
  process.exit(1);
});
