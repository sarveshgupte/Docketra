const assert = require('assert');

// Mock mongoose before requiring any other files
const mongoose = {
  Types: {
    ObjectId: function(id) {
      this.id = id || '507f1f77bcf86cd799439011';
      this.toString = () => this.id;
      return this;
    },
    isValid: (id) => true
  },
  Schema: function() {
    this.index = () => {};
    this.plugin = () => {};
    this.pre = () => {};
    this.post = () => {};
    this.virtual = () => ({ get: () => {} });
    this.methods = {};
    this.set = () => {};
    this.path = () => ({ validate: () => {} });
  },
  model: function(name, schema) {
    return {
      aggregate: async () => [],
      countDocuments: async () => 0,
      find: async () => [],
      findOne: async () => null,
      updateOne: async () => ({ n: 1, matchedCount: 1 }),
      create: async (data) => data,
    };
  },
  models: {}
};
mongoose.Schema.Types = {
  ObjectId: String,
  Mixed: Object
};

require.cache[require.resolve('mongoose')] = { exports: mongoose };

// Mock constants
const constants = {
  CASE_CATEGORIES: { CLIENT_NEW: 'Client - New' },
  CLIENT_STATUS: { ACTIVE: 'ACTIVE' },
  CASE_ACTION_TYPES: { CASE_CREATED: 'CASE_CREATED' },
};
require.cache[require.resolve('../src/config/constants')] = { exports: constants };

// Mock controllers
require.cache[require.resolve('../src/controllers/docketWorkflow.controller')] = { exports: { isValidTransition: () => true } };
require.cache[require.resolve('../src/config/config')] = { exports: { isProduction: () => false, config: {} } };

const Case = require('../src/models/Case.model');

// We must override the repository methods via prototype or proxy if they are frozen,
// but since they are plain objects, we can intercept the require cache for the repositories index
const mockCaseRepository = {
  decryptDocs: async (docs) => {
    docs.forEach(doc => {
      if (doc.description === 'Encrypted description') {
        doc.description = 'Decrypted description';
      }
    });
    return docs;
  }
};

const mockClientRepository = {
  decryptDocs: async (docs) => {
    docs.forEach(doc => {
      if (doc.businessEmail === 'Encrypted email') {
        doc.businessEmail = 'decrypted@example.com';
      }
    });
    return docs;
  }
};

const originalRepositories = require('../src/repositories');
const overriddenRepositories = {
  ...originalRepositories,
  CaseRepository: { ...originalRepositories.CaseRepository, ...mockCaseRepository },
  ClientRepository: { ...originalRepositories.ClientRepository, ...mockClientRepository }
};
// Provide mocked exports for direct repository require paths because controller may require from there directly
require.cache[require.resolve('../src/repositories')] = { exports: overriddenRepositories };
require.cache[require.resolve('../src/repositories/CaseRepository')] = { exports: overriddenRepositories.CaseRepository };
require.cache[require.resolve('../src/repositories/ClientRepository')] = { exports: overriddenRepositories.ClientRepository };

const createMockRes = () => ({
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
  set(headers) {},
  setHeader(name, value) {},
});

const run = async () => {
  console.log('Starting getCases aggregation tests (with mocks)...');

  const originalAggregate = Case.aggregate;
  const originalCountDocuments = Case.countDocuments;
  try {
    const mockFirmId = '507f1f77bcf86cd799439011';
    const mockClientId = 'C123456';
    const mockUser = { firmId: mockFirmId, role: 'Admin', xID: 'X123456', email: 'admin@example.com' };

    const mockCase = {
      caseId: 'CASE-20240101-00001',
      clientId: mockClientId,
      firmId: mockFirmId,
      description: 'Encrypted description',
      client: {
        clientId: mockClientId,
        businessName: 'Mock Client',
        primaryContactNumber: 'Encrypted phone',
        businessEmail: 'Encrypted email',
        status: 'ACTIVE',
        isActive: true,
      }
    };

    Case.aggregate = async (pipeline) => {
      console.log('Mock Case.aggregate called');
      // Verify pipeline structure
      assert.ok(Array.isArray(pipeline), 'Pipeline should be an array');
      // The match stage should have firmId
      const matchStage = pipeline.find(p => p.$match);
      assert.strictEqual(matchStage.$match.firmId, mockFirmId, 'First stage should match firmId');

      const lookup = pipeline.find(p => p.$lookup);
      assert.ok(lookup, 'Pipeline should contain $lookup');
      assert.strictEqual(lookup.$lookup.from, 'clients', 'Lookup should be from clients collection');
      return [JSON.parse(JSON.stringify(mockCase))];
    };

    Case.countDocuments = async () => 1;

    const caseController = require('../src/controllers/case.controller');
    const req = {
      user: mockUser,
      query: { page: 1, limit: 10 }
    };
    const res = createMockRes();

    console.log('Calling caseController.getCases');
    await caseController.getCases(req, res);
    console.log('Result payload:', res.payload);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.success, true);
    assert.strictEqual(res.payload.count, 1);
    assert.strictEqual(res.payload.data[0].description, 'Decrypted description');
    assert.strictEqual(res.payload.data[0].client.businessEmail, 'decrypted@example.com');
    assert.strictEqual(res.payload.data[0].client.businessName, 'Mock Client');

    console.log('✓ getCases aggregation logic verified successfully');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    Case.aggregate = originalAggregate;
    Case.countDocuments = originalCountDocuments;
    require.cache[require.resolve('../src/repositories')] = { exports: originalRepositories };
  }
};

run().catch((error) => {
  console.error('Unhandled test error:', error);
  process.exit(1);
});
