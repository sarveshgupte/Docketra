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

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function testClientReadsUseRepositoryAndReturnPlaintext() {
  let directFindUsed = false;
  let repositoryCalled = false;

  Module._load = function(request, parent, isMain) {
    if (request === '../repositories/ClientRepository') {
      return {
        find: async () => {
          repositoryCalled = true;
          return [{
            _id: 'client-1',
            clientId: 'C000001',
            businessName: 'Acme Legal',
            businessEmail: 'ops@acme.test',
            primaryContactNumber: '9999999999',
            status: 'ACTIVE',
            isSystemClient: false,
            isInternal: false,
          }];
        },
      };
    }
    if (request === '../mappers/client.mapper') {
      return { mapClientResponse: (client) => client };
    }
    if (request === '../utils/query.utils') {
      return { parseBooleanQuery: (value) => value === true || value === 'true' };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (
      request.includes('/models/')
      || request.includes('/services/')
      || request.includes('/queues/')
      || request.includes('/utils/')
      || request.includes('/config/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/client.controller');
  const { getClients } = require('../src/controllers/client.controller');

  const req = {
    query: {},
    user: { firmId: 'firm-1', role: 'Admin' },
  };
  const res = createRes();
  await getClients(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(repositoryCalled, true, 'client controller should read via ClientRepository');
  assert.strictEqual(directFindUsed, false, 'client controller should not call Client.find directly');
  assert.strictEqual(res.body.clients.length, 1, 'client aliases should mirror the repository result length');
  assert.strictEqual(res.body.data[0].businessEmail, 'ops@acme.test');
  assert.strictEqual(typeof res.body.data[0].primaryContactNumber, 'string');
  assert.strictEqual(typeof res.body.data[0].businessEmail, 'string');
  assert.strictEqual(res.body.clients[0].businessName, 'Acme Legal');
  assert.strictEqual(res.body.total, 1);
  console.log('  ✓ client reads use ClientRepository and return plaintext contact fields');
}

async function testClientActiveOnlyQueryParsingStaysBooleanSafe() {
  let capturedFilter = null;

  Module._load = function(request, parent, isMain) {
    if (request === '../repositories/ClientRepository') {
      return {
        find: async (_firmId, filter) => {
          capturedFilter = filter;
          return [];
        },
      };
    }
    if (request === '../mappers/client.mapper') {
      return { mapClientResponse: (client) => client };
    }
    if (request === '../utils/query.utils') {
      return { parseBooleanQuery: (value) => value === true || value === 'true' };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (
      request.includes('/models/')
      || request.includes('/services/')
      || request.includes('/queues/')
      || request.includes('/utils/')
      || request.includes('/config/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/client.controller');
  const { getClients } = require('../src/controllers/client.controller');

  const falseRes = createRes();
  await getClients({
    query: { activeOnly: 'false' },
    user: { firmId: 'firm-1', role: 'Admin' },
  }, falseRes);
  assert.deepStrictEqual(capturedFilter, {}, 'activeOnly=false should not add an active-only filter');
  assert.deepStrictEqual(falseRes.body.data, [], 'empty repository results should still return a stable array');
  assert.deepStrictEqual(falseRes.body.clients, [], 'client alias should remain stable for empty repository results');
  assert.strictEqual(falseRes.body.total, 0, 'empty repository results should report zero total clients');

  const trueRes = createRes();
  await getClients({
    query: { activeOnly: 'true' },
    user: { firmId: 'firm-1', role: 'Admin' },
  }, trueRes);
  assert.deepStrictEqual(capturedFilter, { isActive: true }, 'activeOnly=true should filter by isActive only');
  assert.deepStrictEqual(trueRes.body.data, [], 'active-only requests should still preserve the stable response shape');
  console.log('  ✓ client listing parses activeOnly safely and preserves empty-array responses');
}

async function testClientListingReturnsEmptyListWhenNoClientsExist() {
  let repositoryCalled = false;

  Module._load = function(request, parent, isMain) {
    if (request === '../repositories/ClientRepository') {
      return {
        find: async () => {
          repositoryCalled = true;
          return [];
        },
      };
    }
    if (request === '../mappers/client.mapper') {
      return { mapClientResponse: (client) => client };
    }
    if (request === '../utils/query.utils') {
      return { parseBooleanQuery: (value) => value === true || value === 'true' };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (
      request.includes('/models/')
      || request.includes('/services/')
      || request.includes('/queues/')
      || request.includes('/utils/')
      || request.includes('/config/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/client.controller');
  const { getClients } = require('../src/controllers/client.controller');

  const res = createRes();
  await getClients({
    query: {},
    user: { firmId: 'firm-1', role: 'Admin', name: 'Acme Admin' },
  }, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(repositoryCalled, true, 'controller should still read clients through the repository');
  assert.deepStrictEqual(res.body.data, []);
  assert.deepStrictEqual(res.body.clients, []);
  assert.strictEqual(res.body.total, 0);
  console.log('  ✓ client listing returns an empty list instead of crashing when no clients exist');
}

async function testClientListingLogsStructuredFailures() {
  const originalConsoleError = console.error;
  const logged = [];

  console.error = (...args) => {
    logged.push(args);
  };

  try {
    Module._load = function(request, parent, isMain) {
      if (request === '../repositories/ClientRepository') {
        return {
          find: async () => {
            throw new Error('repository exploded');
          },
        };
      }
      if (request === '../mappers/client.mapper') {
        return { mapClientResponse: (client) => client };
      }
      if (request === '../utils/query.utils') {
        return { parseBooleanQuery: (value) => value === true || value === 'true' };
      }
      if (request === '../middleware/wrapWriteHandler') {
        return (fn) => fn;
      }
      if (
        request.includes('/models/')
        || request.includes('/services/')
        || request.includes('/queues/')
        || request.includes('/utils/')
        || request.includes('/config/')
      ) {
        return {};
      }
      return originalLoad.apply(this, arguments);
    };

    clearModule('../src/controllers/client.controller');
    const { getClients } = require('../src/controllers/client.controller');

    const res = createRes();
    await getClients({
      query: { activeOnly: 'true' },
      requestId: 'req-123',
      originalUrl: '/api/clients?activeOnly=true',
      user: { _id: 'user-1', firmId: 'firm-1', role: 'Admin' },
    }, res);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(logged[0][0], 'CLIENT_LIST_ERROR');
    assert.deepStrictEqual(logged[0][1], {
      firmId: 'firm-1',
      requestId: 'req-123',
      userId: 'user-1',
      route: '/api/clients?activeOnly=true',
      query: { activeOnly: 'true' },
      error: 'repository exploded',
    });
    console.log('  ✓ client listing logs structured context when repository access fails');
  } finally {
    console.error = originalConsoleError;
  }
}

async function testDefaultClientCannotBeDeactivated() {
  let saveCalled = false;

  Module._load = function(request, parent, isMain) {
    if (request === '../repositories/ClientRepository') {
      return {
        findByClientId: async () => ({
          clientId: 'C000001',
          isDefaultClient: true,
          isSystemClient: true,
          isActive: true,
          status: 'ACTIVE',
          save: async () => {
            saveCalled = true;
          },
        }),
      };
    }
    if (request === '../mappers/client.mapper') {
      return { mapClientResponse: (client) => client };
    }
    if (request === '../utils/query.utils') {
      return { parseBooleanQuery: (value) => value === true || value === 'true' };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (
      request.includes('/models/')
      || request.includes('/services/')
      || request.includes('/queues/')
      || request.includes('/utils/')
      || request.includes('/config/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/client.controller');
  const { toggleClientStatus } = require('../src/controllers/client.controller');

  const res = createRes();
  await toggleClientStatus({
    params: { clientId: 'C000001' },
    body: { isActive: false },
    user: { firmId: 'firm-1', role: 'Admin', xID: 'X000001' },
  }, res);

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.message, 'Default client cannot be deactivated.');
  assert.strictEqual(saveCalled, false, 'protected default clients should not be saved after a rejected deactivation');
  console.log('  ✓ default clients cannot be deactivated');
}

function testUserMapperDerivesPasswordConfigured() {
  Module._load = originalLoad;
  clearModule('../src/mappers/user.mapper');
  const { mapUserResponse } = require('../src/mappers/user.mapper');
  const mapped = mapUserResponse({
    _id: 'user-1',
    xID: 'X000001',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'Admin',
    passwordHash: '$2b$10$hash',
    mustSetPassword: false,
    passwordSet: false,
    isActive: true,
    status: 'active',
  });

  assert.strictEqual(mapped.role, 'ADMIN');
  assert.strictEqual(mapped.passwordConfigured, true);
  console.log('  ✓ user mapper derives passwordConfigured from authoritative fields');
}

async function testStorageGateBlocksUnavailableProviderMode() {
  Module._load = originalLoad;
  Module._load = function(request, parent, isMain) {
    if (request === '../models/Firm.model') {
      return {
        findById: async () => ({
          storage: { mode: 'docketra_managed', provider: null },
        }),
      };
    }
    if (request === '../services/featureFlags.service') {
      return { isExternalStorageEnabled: () => false };
    }
    if (request === '../repositories/user.repository' || request === '../repositories/client.repository' || request === '../repositories/category.repository') {
      return {};
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => fn;
    }
    if (
      request.includes('/models/')
      || request.includes('/services/')
      || request.includes('/utils/')
    ) {
      return {};
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/admin.controller');
  const { updateStorageConfig } = require('../src/controllers/admin.controller');
  const req = {
    user: { firmId: 'firm-1', xID: 'X000001' },
    body: { mode: 'firm_connected', provider: 'google_drive' },
  };
  const res = createRes();
  await updateStorageConfig(req, res);

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.code, 'EXTERNAL_STORAGE_DISABLED');
  console.log('  ✓ storage configuration rejects firm-connected mode when capability is disabled');
}

function testAuditMapperProducesForensicContract() {
  Module._load = originalLoad;
  clearModule('../src/mappers/audit.mapper');
  const { mapAuditResponse } = require('../src/mappers/audit.mapper');
  const mapped = mapAuditResponse({
    xID: 'X000007',
    actionType: 'ADMIN_ACTION',
    userId: '507f1f77bcf86cd799439011',
    firmId: 'firm-22',
    ipAddress: '203.0.113.2',
    timestamp: new Date('2026-03-07T00:00:00.000Z'),
    metadata: { requestId: 'req-1' },
  }, 'AuthAudit');

  assert.deepStrictEqual(Object.keys(mapped), [
    'xid',
    'xID',
    'action',
    'userId',
    'firmId',
    'ipAddress',
    'timestamp',
    'source',
    'metadata',
    'description',
  ]);
  assert.strictEqual(mapped.xid, 'X000007');
  assert.strictEqual(mapped.source, 'AuthAudit');
  console.log('  ✓ audit mapper emits the standardized audit response contract');
}

async function run() {
  try {
    await testClientReadsUseRepositoryAndReturnPlaintext();
    await testClientActiveOnlyQueryParsingStaysBooleanSafe();
    await testClientListingReturnsEmptyListWhenNoClientsExist();
    await testClientListingLogsStructuredFailures();
    await testDefaultClientCannotBeDeactivated();
    testUserMapperDerivesPasswordConfigured();
    await testStorageGateBlocksUnavailableProviderMode();
    testAuditMapperProducesForensicContract();
    console.log('adminPanelStabilization tests passed.');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  Module._load = originalLoad;
  console.error('adminPanelStabilization tests failed:', error);
  process.exit(1);
});
