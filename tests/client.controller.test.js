#!/usr/bin/env node
const assert = require('assert');

// Mock dependencies
const mockClientRepository = {
  findAll: async () => [],
  findByClientId: async () => null,
  find: async () => [], // Add find method as it's used in the controller
};

const mockCase = {
  find: () => mockCase,
  sort: () => mockCase,
  limit: () => mockCase,
  select: () => mockCase,
  lean: async () => [],
};

const mockFirm = {
  findById: () => mockFirm,
  select: () => mockFirm,
  lean: async () => ({ storage: { mode: 'firm_connected' } }),
};

const mockAttachmentRepository = {
  findByClientSource: async () => [],
};

const mockStorageProviderFactory = {
  getProvider: async () => ({}),
};

const mockDefaultClientService = {
  ensureDefaultClientForFirm: async () => true
};

// Override require cache
require.cache[require.resolve('../src/repositories/ClientRepository')] = {
  id: require.resolve('../src/repositories/ClientRepository'),
  filename: require.resolve('../src/repositories/ClientRepository'),
  loaded: true,
  exports: mockClientRepository,
};

require.cache[require.resolve('../src/models/Case.model')] = {
  id: require.resolve('../src/models/Case.model'),
  filename: require.resolve('../src/models/Case.model'),
  loaded: true,
  exports: mockCase,
};

require.cache[require.resolve('../src/models/Firm.model')] = {
  id: require.resolve('../src/models/Firm.model'),
  filename: require.resolve('../src/models/Firm.model'),
  loaded: true,
  exports: mockFirm,
};

require.cache[require.resolve('../src/repositories/AttachmentRepository')] = {
  id: require.resolve('../src/repositories/AttachmentRepository'),
  filename: require.resolve('../src/repositories/AttachmentRepository'),
  loaded: true,
  exports: mockAttachmentRepository,
};

require.cache[require.resolve('../src/services/storage/StorageProviderFactory')] = {
  id: require.resolve('../src/services/storage/StorageProviderFactory'),
  filename: require.resolve('../src/services/storage/StorageProviderFactory'),
  loaded: true,
  exports: { StorageProviderFactory: mockStorageProviderFactory },
};

require.cache[require.resolve('../src/services/defaultClient.service')] = {
  id: require.resolve('../src/services/defaultClient.service'),
  filename: require.resolve('../src/services/defaultClient.service'),
  loaded: true,
  exports: mockDefaultClientService,
};

const clientController = require('../src/controllers/client.controller');

async function testGetClients() {
  const req = {
    user: { firmId: '60c72b2f9b1d8b001c8e4b5a', role: 'admin' },
    query: { limit: '10', page: '1' },
    requestId: 'req123',
    originalUrl: '/api/clients',
  };
  const res = {
    statusCode: null,
    jsonData: null,
    headers: {},
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.jsonData = data;
      return this;
    },
    setHeader: function (key, value) {
      this.headers[key] = value;
    },
  };

  mockClientRepository.find = async () => [
    { clientId: 'C000001', businessName: 'Test Business' },
  ];

  await clientController.getClients(req, res);

  assert.strictEqual(res.statusCode || 200, 200);
  assert.strictEqual(res.jsonData.success, true);
  assert.strictEqual(res.jsonData.data.length, 1);
  assert.strictEqual(res.jsonData.data[0].clientId, 'C000001');
}

async function testListClientDockets() {
  const req = {
    user: { firmId: '60c72b2f9b1d8b001c8e4b5a', role: 'admin' },
    params: { clientId: 'C000001' },
    query: { limit: '10', order: 'desc' },
  };
  const res = {
    statusCode: null,
    jsonData: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.jsonData = data;
      return this;
    },
  };

  mockCase.lean = async () => [
    { caseId: 'CASE-001', status: 'PENDING' },
  ];

  await clientController.listClientDockets(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.jsonData.success, true);
  assert.strictEqual(res.jsonData.data.length, 1);
  assert.strictEqual(res.jsonData.data[0].caseId, 'CASE-001');
}

async function run() {
  try {
    await testGetClients();
    console.log('testGetClients passed');

    await testListClientDockets();
    console.log('testListClientDockets passed');

    console.log('client.controller.test.js passed successfully.');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

run();
