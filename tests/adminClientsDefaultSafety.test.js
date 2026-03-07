#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

const createRes = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

async function testAdminClientsAutoCreatesDefaultAndNormalizesResponse() {
  const captured = { ensureCalls: 0 };
  const mutableClients = [
    {
      clientId: 'C000010',
      businessName: 'External Co',
      businessEmail: 'ops@external.co',
      primaryContactNumber: '9999999999',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      isSystemClient: false,
      isInternal: false,
      firmId: 'firm-1',
    },
  ];

  const firmDoc = {
    _id: 'firm-1',
    firmId: 'FIRM001',
    name: 'Acme Legal',
    defaultClientId: null,
  };

  const mockClientModel = {
    find: () => ({
      select: () => ({
        sort: async () => mutableClients.map((client) => ({
          ...client,
          toObject: () => ({ ...client }),
        })),
      }),
    }),
  };

  const mockFirmModel = {
    findById: () => ({
      select: async () => firmDoc,
    }),
  };

  const mockDefaultClientService = {
    ensureDefaultClientForFirm: async () => {
      captured.ensureCalls += 1;
      const hasSystem = mutableClients.some((client) => client.isSystemClient);
      if (!hasSystem) {
        mutableClients.unshift({
          clientId: 'C000001',
          businessName: firmDoc.name,
          businessEmail: 'firm001@system.local',
          primaryContactNumber: '0000000000',
          status: 'ACTIVE',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          isSystemClient: true,
          isInternal: true,
          firmId: 'firm-1',
        });
      }
    },
  };

  Module._load = function (request, parent, isMain) {
    if (request === '../models/Client.model') return mockClientModel;
    if (request === '../models/Firm.model') return mockFirmModel;
    if (request === '../services/defaultClient.service') return mockDefaultClientService;
    if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/models/Client.model');
  clearModule('../src/models/Firm.model');
  clearModule('../src/services/defaultClient.service');
  clearModule('../src/controllers/client.controller');
  const { getClients } = require('../src/controllers/client.controller');

  const req = {
    query: {},
    user: { role: 'Admin', firmId: 'firm-1', xID: 'X000001' },
  };
  const res = createRes();

  await getClients(req, res);

  assert.strictEqual(captured.ensureCalls, 1, 'should ensure a default client before returning firm clients');
  assert.strictEqual(res.statusCode, 200, 'admin clients fetch should succeed');
  assert.strictEqual(res.payload.success, true, 'response should preserve success wrapper');
  assert.ok(Array.isArray(res.payload.data), 'response data should be an array');
  assert.strictEqual(res.payload.count, res.payload.data.length, 'count should match data length');
  assert.ok(res.payload.data[0].is_default, 'default internal client should be marked as is_default');
  assert.strictEqual(res.payload.data[0].type, 'internal', 'default client should be normalized as internal type');
  assert.strictEqual(res.payload.data[0].name, 'Acme Legal', 'normalized name should mirror businessName');
  console.log('  ✓ ensures default client and returns normalized admin client payload');
}

async function testDefaultClientCannotBeDisabled() {
  const mockClientModel = {
    findOne: async () => ({
      clientId: 'C009999',
      isSystemClient: true,
      isInternal: true,
      save: async () => {
        throw new Error('save must not be called when deactivating default client');
      },
    }),
  };

  Module._load = function (request, parent, isMain) {
    if (request === '../models/Client.model') return mockClientModel;
    if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/models/Client.model');
  clearModule('../src/controllers/client.controller');
  const { toggleClientStatus } = require('../src/controllers/client.controller');

  const req = {
    params: { clientId: 'C009999' },
    body: { isActive: false },
    user: { role: 'Admin', firmId: 'firm-1', xID: 'X000001' },
  };
  const res = createRes();

  await toggleClientStatus(req, res, () => {});

  assert.strictEqual(res.statusCode, 403, 'default client deactivation should be blocked');
  assert.strictEqual(
    res.payload?.message,
    'Cannot deactivate the default internal client. This is a protected system entity.',
    'response should explain default client protection'
  );
  console.log('  ✓ blocks default/internal client deactivation');
}

async function run() {
  console.log('Running admin client default safety tests...');
  try {
    await testAdminClientsAutoCreatesDefaultAndNormalizesResponse();
    await testDefaultClientCannotBeDisabled();
    console.log('All admin client default safety tests passed.');
  } finally {
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  console.error('Admin client default safety tests failed:', error);
  process.exit(1);
});
