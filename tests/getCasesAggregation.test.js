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
  }
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
require.cache[require.resolve('./docketWorkflow.controller')] = { exports: { isValidTransition: () => true } };

const Case = require('../src/models/Case.model');
const { CaseRepository, ClientRepository } = require('../src/repositories');

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
  const originalCaseDecrypt = CaseRepository.decryptDocs;
  const originalClientDecrypt = ClientRepository.decryptDocs;

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

    CaseRepository.decryptDocs = async (docs) => {
      docs.forEach(doc => {
        if (doc.description === 'Encrypted description') {
          doc.description = 'Decrypted description';
        }
      });
      return docs;
    };

    ClientRepository.decryptDocs = async (docs) => {
      docs.forEach(doc => {
        if (doc.businessEmail === 'Encrypted email') {
          doc.businessEmail = 'decrypted@example.com';
        }
      });
      return docs;
    };

    const caseController = require('../src/controllers/case.controller');
    const req = {
      user: mockUser,
      query: { page: 1, limit: 10 }
    };
    const res = createMockRes();

    await caseController.getCases(req, res);

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
    CaseRepository.decryptDocs = originalCaseDecrypt;
    ClientRepository.decryptDocs = originalClientDecrypt;
  }
};

run().catch((error) => {
  console.error('Unhandled test error:', error);
  process.exit(1);
});
