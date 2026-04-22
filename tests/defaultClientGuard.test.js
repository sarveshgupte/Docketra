#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses in tests
  }
};

async function testEnsureDefaultClientReturnsExistingClient() {
  let findOneAndUpdateCalls = 0;
  let generatorCalls = 0;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        findOne: () => ({
          session() {
            return this;
          },
          then(resolve) {
            return Promise.resolve(resolve({ _id: 'client-1', clientId: 'C000001', firmId: 'firm-1', isDefaultClient: true }));
          },
        }),
        findOneAndUpdate: async () => {
          findOneAndUpdateCalls += 1;
          return { _id: 'client-1', clientId: 'C000001', firmId: 'firm-1', isDefaultClient: true };
        },
      };
    }
    if (request === './clientIdGenerator') {
      return {
        generateNextClientId: async () => {
          generatorCalls += 1;
          return 'C000001';
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/defaultClient.guard');
  const { ensureDefaultClient } = require('../src/services/defaultClient.guard');
  const existing = await ensureDefaultClient('firm-1', 'Acme Legal');

  assert.strictEqual(generatorCalls, 0);
  assert.strictEqual(findOneAndUpdateCalls, 0);
  assert.strictEqual(existing.clientId, 'C000001');
  console.log('  ✓ default client guard returns existing default client');
}

async function testEnsureDefaultClientCreatesAndLogsMissingClient() {
  const expectedBusinessEmail = `firm2-${Buffer.from('firm-2').toString('hex')}@system.local`;
  let updateArgs = null;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        findOne: () => ({
          session() {
            return this;
          },
          then(resolve) {
            return Promise.resolve(resolve(null));
          },
        }),
        findOneAndUpdate: async (...args) => {
          updateArgs = args;
          return { _id: 'client-2', ...args[1].$setOnInsert };
        },
      };
    }
    if (request === './clientIdGenerator') {
      return {
        generateNextClientId: async () => 'C000001',
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/defaultClient.guard');
  const { ensureDefaultClient } = require('../src/services/defaultClient.guard');
  const created = await ensureDefaultClient('firm-2', 'Beta Legal');

  assert.strictEqual(created.clientId, 'C000001');
  assert.deepStrictEqual(updateArgs, [
    { firmId: 'firm-2', isDefaultClient: true },
    {
      $setOnInsert: {
        clientId: 'C000001',
        firmId: 'firm-2',
        isDefaultClient: true,
        isSystemClient: true,
        isInternal: true,
        createdBySystem: true,
        businessName: 'Beta Legal',
        primaryContactNumber: '0000000000',
        businessEmail: expectedBusinessEmail,
        status: 'ACTIVE',
        isActive: true,
        createdByXid: 'SYSTEM',
        createdBy: 'system',
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      session: null,
    },
  ]);
  console.log('  ✓ default client guard upserts missing default clients');
}

async function testAuthenticateRunsDefaultClientGuard() {
  let guardArgs = null;
  let nextCalled = false;
  const userRecord = {
    _id: 'user-1',
    xID: 'X000001',
    role: 'Admin',
    firmId: 'firm-1',
    status: 'active',
    mustSetPassword: false,
    mustChangePassword: false,
    defaultClientId: null,
    save: async function save() {
      return this;
    },
    toObject() {
      return {
        _id: this._id,
        xID: this.xID,
        role: this.role,
        firmId: this.firmId,
        status: this.status,
        mustSetPassword: this.mustSetPassword,
        mustChangePassword: this.mustChangePassword,
        defaultClientId: this.defaultClientId,
      };
    },
  };

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async () => userRecord,
      };
    }
    if (request === '../services/jwt.service') {
      return {
        extractTokenFromHeader: () => 'token',
        verifyAccessToken: () => ({ userId: 'user-1', firmId: 'firm-1', role: 'Admin' }),
      };
    }
    if (request === '../utils/role.utils') {
      return {
        isSuperAdminRole: () => false,
        normalizeRole: (role) => String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_'),
      };
    }
    if (request === '../services/metrics.service') {
      return {
        recordAuthFailure: () => {},
      };
    }
    if (request === '../utils/requestCookies') {
      return {
        getCookieValue: () => null,
      };
    }
    if (request === '../utils/status.utils') {
      return {
        isActiveStatus: () => true,
        getFirmInactiveCode: () => 'INACTIVE',
      };
    }
    if (request === './attachRequestContext') {
      return {
        buildRequestContext: () => ({ route: '/api/clients', requestId: 'req-guard' }),
      };
    }
    if (request === '../services/defaultClient.guard') {
      return {
        getOrCreateDefaultClient: async (...args) => {
          guardArgs = args;
          return { _id: 'client-1', clientId: 'C000001' };
        },
      };
    }
    if (request === '../models/Client.model') {
      return {
        findOne: () => ({
          select() {
            return this;
          },
          lean: async () => ({ _id: 'firm-1', status: 'ACTIVE' }),
        }),
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/middleware/auth.middleware');
  const { authenticate } = require('../src/middleware/auth.middleware');
  const req = {
    method: 'GET',
    headers: { authorization: 'Bearer token' },
    originalUrl: '/api/clients',
    path: '/api/clients',
    requestId: 'req-guard',
  };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'authenticate should continue after running the default client guard');
  assert.deepStrictEqual(guardArgs, ['firm-1', { userId: 'user-1', requestId: 'req-guard' }]);
  assert.strictEqual(req.user.role, 'Admin', 'auth middleware should preserve the JWT role on the request when it matches');
  assert.strictEqual(req.jwt.role, 'Admin', 'auth middleware should expose the effective request role in req.jwt');
  assert.strictEqual(req.user.defaultClientId, 'client-1', 'auth middleware should persist the repaired default client link');
  console.log('  ✓ auth middleware runs the default client guard for tenant requests');
}

async function testAuthenticateFallsBackToDatabaseRoleWhenTokenRoleMissing() {
  const userRecord = {
    _id: 'user-2',
    xID: 'X000002',
    role: 'ADMIN',
    firmId: 'firm-2',
    status: 'active',
    mustSetPassword: false,
    mustChangePassword: false,
    defaultClientId: 'client-2',
    save: async function save() {
      return this;
    },
    toObject() {
      return {
        _id: this._id,
        xID: this.xID,
        role: this.role,
        firmId: this.firmId,
        status: this.status,
        mustSetPassword: this.mustSetPassword,
        mustChangePassword: this.mustChangePassword,
        defaultClientId: this.defaultClientId,
      };
    },
  };

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async () => userRecord,
      };
    }
    if (request === '../services/jwt.service') {
      return {
        extractTokenFromHeader: () => 'token',
        verifyAccessToken: () => ({ userId: 'user-2', firmId: 'firm-2' }),
      };
    }
    if (request === '../utils/role.utils') {
      return {
        isSuperAdminRole: () => false,
        normalizeRole: (role) => String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_'),
      };
    }
    if (request === '../services/metrics.service') {
      return {
        recordAuthFailure: () => {},
      };
    }
    if (request === '../utils/requestCookies') {
      return {
        getCookieValue: () => null,
      };
    }
    if (request === '../utils/status.utils') {
      return {
        isActiveStatus: () => true,
        getFirmInactiveCode: () => 'INACTIVE',
      };
    }
    if (request === './attachRequestContext') {
      return {
        buildRequestContext: () => ({ route: '/api/reports', requestId: 'req-role-cache' }),
      };
    }
    if (request === '../services/defaultClient.guard') {
      return {
        getOrCreateDefaultClient: async () => ({ _id: 'client-2' }),
      };
    }
    if (request === '../models/Client.model') {
      return {
        findById: () => ({
          select() {
            return this;
          },
          lean: async () => ({ _id: 'client-2', firmId: 'firm-2', isDefaultClient: true }),
        }),
        findOne: () => ({
          select() {
            return this;
          },
          lean: async () => ({ _id: 'firm-2', status: 'ACTIVE' }),
        }),
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/middleware/auth.middleware');
  const { authenticate } = require('../src/middleware/auth.middleware');
  const req = {
    method: 'GET',
    headers: { authorization: 'Bearer token' },
    originalUrl: '/api/reports',
    path: '/api/reports',
    requestId: 'req-role-cache',
  };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'authenticate should continue when DB role fallback succeeds');
  assert.strictEqual(req.user.role, 'ADMIN', 'request role should fall back to the current DB role when JWT role is missing');
  assert.strictEqual(req.jwt.role, 'ADMIN', 'effective JWT role should fall back to the current DB role when JWT role is missing');
  console.log('  ✓ auth middleware falls back to the database role when the JWT role is missing');
}

async function testAuthenticateFallsBackToDatabaseRoleWhenTokenRoleIsStale() {
  const userRecord = {
    _id: 'user-2',
    xID: 'X000002',
    role: 'ADMIN',
    firmId: 'firm-2',
    status: 'active',
    mustSetPassword: false,
    mustChangePassword: false,
    defaultClientId: 'client-2',
    save: async function save() {
      return this;
    },
    toObject() {
      return {
        _id: this._id,
        xID: this.xID,
        role: this.role,
        firmId: this.firmId,
        status: this.status,
        mustSetPassword: this.mustSetPassword,
        mustChangePassword: this.mustChangePassword,
        defaultClientId: this.defaultClientId,
      };
    },
  };

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async () => userRecord,
      };
    }
    if (request === '../services/jwt.service') {
      return {
        extractTokenFromHeader: () => 'token',
        verifyAccessToken: () => ({ userId: 'user-2', firmId: 'firm-2', role: 'USER' }),
      };
    }
    if (request === '../utils/role.utils') {
      return {
        isSuperAdminRole: () => false,
        normalizeRole: (role) => String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_'),
      };
    }
    if (request === '../services/metrics.service') {
      return {
        recordAuthFailure: () => {},
      };
    }
    if (request === '../utils/requestCookies') {
      return {
        getCookieValue: () => null,
      };
    }
    if (request === '../utils/status.utils') {
      return {
        isActiveStatus: () => true,
        getFirmInactiveCode: () => 'INACTIVE',
      };
    }
    if (request === './attachRequestContext') {
      return {
        buildRequestContext: () => ({ route: '/api/reports', requestId: 'req-role-cache' }),
      };
    }
    if (request === '../services/defaultClient.guard') {
      return {
        getOrCreateDefaultClient: async () => ({ _id: 'client-2' }),
      };
    }
    if (request === '../models/Client.model') {
      return {
        findById: () => ({
          select() {
            return this;
          },
          lean: async () => ({ _id: 'client-2', firmId: 'firm-2', isDefaultClient: true }),
        }),
        findOne: () => ({
          select() {
            return this;
          },
          lean: async () => ({ _id: 'firm-2', status: 'ACTIVE' }),
        }),
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/middleware/auth.middleware');
  const { authenticate } = require('../src/middleware/auth.middleware');
  const req = {
    method: 'GET',
    headers: { authorization: 'Bearer token' },
    originalUrl: '/api/reports',
    path: '/api/reports',
    requestId: 'req-role-cache',
  };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'authenticate should continue when stale JWT role is corrected');
  assert.strictEqual(req.user.role, 'ADMIN', 'request role should be overwritten with the current DB role when JWT role is stale');
  assert.strictEqual(req.jwt.role, 'ADMIN', 'effective JWT role should be overwritten with the current DB role when JWT role is stale');
  console.log('  ✓ auth middleware falls back to the database role when the JWT role is stale');
}

async function run() {
  try {
    await testEnsureDefaultClientReturnsExistingClient();
    await testEnsureDefaultClientCreatesAndLogsMissingClient();
    await testAuthenticateRunsDefaultClientGuard();
    await testAuthenticateFallsBackToDatabaseRoleWhenTokenRoleMissing();
    await testAuthenticateFallsBackToDatabaseRoleWhenTokenRoleIsStale();
    console.log('Default client guard tests passed.');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  console.error(error);
  Module._load = originalLoad;
  process.exit(1);
});
