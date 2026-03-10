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
  let findCalls = 0;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/Client.model') {
      return {
        findOne: async () => {
          findCalls += 1;
          return { _id: 'client-1', clientId: 'C000001', firmId: 'firm-1', isDefaultClient: true };
        },
      };
    }
    if (request === './clientIdGenerator') {
      return {
        generateNextClientId: async () => {
          throw new Error('generator should not run when default client exists');
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/services/defaultClient.guard');
  const { ensureDefaultClient } = require('../src/services/defaultClient.guard');
  const existing = await ensureDefaultClient('firm-1', 'Acme Legal');

  assert.strictEqual(findCalls, 1);
  assert.strictEqual(existing.clientId, 'C000001');
  console.log('  ✓ default client guard returns existing default client');
}

async function testEnsureDefaultClientCreatesAndLogsMissingClient() {
  const originalWarn = console.warn;
  const warnings = [];
  let createdPayload = null;
  let findCalls = 0;

  console.warn = (...args) => warnings.push(args);

  try {
    const expectedBusinessEmail = `firm2-${Buffer.from('firm-2').toString('hex')}@system.local`;

    Module._load = function(request, parent, isMain) {
      if (request === '../models/Client.model') {
        return {
          findOne: async () => {
            findCalls += 1;
            return null;
          },
          create: async (payload) => {
            createdPayload = payload;
            return { _id: 'client-2', ...payload };
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

    assert.strictEqual(findCalls, 1);
    assert.strictEqual(created.clientId, 'C000001');
    assert.deepStrictEqual(createdPayload, {
      clientId: 'C000001',
      firmId: 'firm-2',
      businessName: 'Beta Legal',
      businessAddress: 'Default Address',
      primaryContactNumber: '0000000000',
      businessEmail: expectedBusinessEmail,
      isDefaultClient: true,
      isSystemClient: true,
      isInternal: true,
      createdBySystem: true,
      status: 'ACTIVE',
      isActive: true,
      createdByXid: 'SYSTEM',
      createdBy: 'system',
    });
    assert.strictEqual(warnings[0][0], '[DEFAULT_CLIENT_GUARD] Auto-created missing default client');
    assert.deepStrictEqual(warnings[0][1], {
      firmId: 'firm-2',
      clientId: 'C000001',
      businessName: 'Beta Legal',
    });
    console.log('  ✓ default client guard auto-creates and logs missing default clients');
  } finally {
    console.warn = originalWarn;
  }
}

async function testAuthenticateRunsDefaultClientGuard() {
  let guardArgs = null;
  let nextCalled = false;

  Module._load = function(request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async () => ({
          _id: 'user-1',
          xID: 'X000001',
          role: 'Admin',
          firmId: 'firm-1',
          status: 'active',
          mustSetPassword: false,
          mustChangePassword: false,
        }),
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
        ensureDefaultClient: async (...args) => {
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
  assert.deepStrictEqual(guardArgs, ['firm-1', null]);
  assert.strictEqual(req.defaultClient.clientId, 'C000001');
  console.log('  ✓ auth middleware runs the default client guard for tenant requests');
}

async function run() {
  try {
    await testEnsureDefaultClientReturnsExistingClient();
    await testEnsureDefaultClientCreatesAndLogsMissingClient();
    await testAuthenticateRunsDefaultClientGuard();
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
